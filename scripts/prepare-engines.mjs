import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "public/engines");
await mkdir(output, { recursive: true });
const copy = async (source, dest) => {
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    if ((await stat(source)).size === (await stat(dest)).size) return;
  } catch {}
  await copyFile(source, dest);
};
for (const [pkg, name] of [
  ["@jspawn/ghostscript-wasm", "gs"],
  ["@jspawn/qpdf-wasm", "qpdf"],
]) {
  for (const file of await readdir(path.join(root, "node_modules", pkg))) {
    if (file.endsWith(".js") || file.endsWith(".wasm"))
      await copy(
        path.join(root, "node_modules", pkg, file),
        path.join(output, name, file),
      );
  }
}
await copy(
  path.join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  path.join(output, "ocr/worker.min.js"),
);
for (const file of await readdir(
  path.join(root, "node_modules/tesseract.js-core"),
)) {
  if (file.endsWith(".wasm") || file.endsWith(".wasm.js"))
    await copy(
      path.join(root, "node_modules/tesseract.js-core", file),
      path.join(output, "ocr", file),
    );
}
await copy(
  path.join(root, "backend/fonts/DejaVuSans.ttf"),
  path.join(output, "font.ttf"),
);
await copy(
  path.join(root, "backend/fonts/sRGB.icc"),
  path.join(output, "sRGB.icc"),
);
for (const lang of ["eng", "por", "spa"])
  await copy(
    path.join(root, `assets/ocr/${lang}.traineddata.gz`),
    path.join(output, `ocr/${lang}.traineddata.gz`),
  );
const validator = path.join(root, ".tools/verapdf/bin/cli-1.30.3.jar");
try {
  await stat(validator);
} catch {
  const url =
    "https://repo.maven.apache.org/maven2/org/verapdf/apps/cli/1.30.3/cli-1.30.3.jar";
  await mkdir(path.dirname(validator), { recursive: true });
  const expected = execFileSync(
    "curl",
    ["--fail", "--silent", "--show-error", "--location", `${url}.sha512`],
    { maxBuffer: 4096 },
  )
    .toString()
    .trim()
    .split(/\s+/)[0];
  const data = execFileSync(
    "curl",
    ["--fail", "--silent", "--show-error", "--location", url],
    { maxBuffer: 30 * 1024 * 1024 },
  );
  if (createHash("sha512").update(data).digest("hex") !== expected)
    throw new Error("O checksum do veraPDF não confere.");
  await writeFile(validator, data);
}
console.log(
  "Motores locais preparados: Ghostscript, qpdf, OCR e veraPDF. Office é processado em uma função separada.",
);
