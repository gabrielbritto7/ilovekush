import formidable from "formidable";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { OfficeRuntime } from "../server/office-runtime.mjs";

let activeRequests = 0;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method === "GET") {
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        status: "ok",
        engine: "LibreOffice WASM",
        max_upload_mb: 4,
      }),
    );
    return;
  }
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.end();
    return;
  }
  if (activeRequests >= 1) {
    response.statusCode = 429;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ detail: "O conversor está ocupado. Tente novamente em alguns instantes." }));
    return;
  }
  activeRequests++;
  let folder;
  const converter = new OfficeRuntime();
  try {
    folder = await mkdtemp(path.join(tmpdir(), "kush-office-"));
    if (
      Number(request.headers["content-length"] || 0) >
      4 * 1024 * 1024 + 128 * 1024
    )
      throw new Error("O conversor Office aceita até 4 MB no total.");
    const form = formidable({
      uploadDir: folder,
      maxFiles: 10,
      maxTotalFileSize: 4 * 1024 * 1024,
      maxFileSize: 4 * 1024 * 1024,
      allowEmptyFiles: false,
      maxFieldsSize: 200000,
    });
    const [, uploads] = await form.parse(request);
    const files = uploads.files || [];
    if (!files.length) throw new Error("Selecione um documento Office.");
    const allowed = new Set([
      "doc",
      "docx",
      "odt",
      "rtf",
      "xls",
      "xlsx",
      "ods",
      "csv",
      "ppt",
      "pptx",
      "odp",
    ]);
    const parts = {};
    for (const file of files) {
      const ext = path.extname(file.originalFilename || "").slice(1).toLowerCase();
      if (!allowed.has(ext)) throw new Error("Formato Office não suportado.");
    }
    await converter.initialize();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path
        .extname(file.originalFilename || "")
        .slice(1)
        .toLowerCase();
      if (!allowed.has(ext)) throw new Error("Formato Office não suportado.");
      const data = await converter.convert(await readFile(file.filepath), ext);
      if (data.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("O conversor não gerou um PDF válido.");
      const base =
        path
          .basename(file.originalFilename, path.extname(file.originalFilename))
          .replace(/[^\p{L}\p{N} _-]/gu, "-")
          .slice(0, 70) || "documento";
      let name = `${base}.pdf`;
      if (parts[name]) name = `${base}-${i + 1}.pdf`;
      parts[name] = data;
    }
    const names = Object.keys(parts);
    const data =
      names.length === 1 ? parts[names[0]] : Buffer.from(zipSync(parts));
    if (data.length > 4 * 1024 * 1024)
      throw new Error(
        "O resultado excedeu 4 MB. Converta um documento menor ou use o servidor completo.",
      );
    const filename = names.length === 1 ? names[0] : "ilovekush-office.zip";
    response.setHeader(
      "Content-Type",
      names.length === 1 ? "application/pdf" : "application/zip",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    response.setHeader("X-Kush-Output-Count", names.length);
    response.end(data);
  } catch (error) {
    response.statusCode = error.httpCode === 413 ? 413 : 422;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        detail:
          error.httpCode === 413
            ? "O conversor Office aceita até 4 MB no total."
            : error.message || "Não foi possível converter o documento.",
      }),
    );
  } finally {
    converter.close();
    if (folder) await rm(folder, { recursive: true, force: true });
    activeRequests--;
  }
}
