import {
  PDFDocument,
  rgb,
  degrees,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { strToU8, zipSync } from "fflate";
import { loadPdf, renderPage, pageText } from "./pdf";

export type Options = Record<string, any>;
export type Output = {
  blob: Blob;
  name: string;
  count: number;
  local: boolean;
};
type Part = { name: string; data: Uint8Array };
export const localTools = new Set([
  "merge",
  "split",
  "organize",
  "rotate",
  "jpg-pdf",
  "scan",
  "compress",
  "protect",
  "unlock",
  "repair",
  "pdfa",
  "edit",
  "sign",
  "watermark",
  "pagenumber",
  "crop",
  "pdf-jpg",
  "extract",
  "markdown",
  "summarize",
  "smart-split",
  "pdf-word",
  "pdf-excel",
  "pdf-powerpoint",
  "forms",
  "ocr",
  "html-pdf",
  "compare",
  "redact",
]);
const stem = (file: File) => file.name.replace(/\.[^.]+$/, "");
const bytes = async (file: File) => new Uint8Array(await file.arrayBuffer());
const blob = (data: Uint8Array, type = "application/octet-stream") =>
  new Blob([new Uint8Array(data).buffer], { type });
let fontBytes: Promise<ArrayBuffer>;
async function font(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  fontBytes ||= fetch("/engines/font.ttf").then((r) => {
    if (!r.ok) throw new Error("Não foi possível carregar a fonte.");
    return r.arrayBuffer();
  });
  return doc.embedFont(await fontBytes, { subset: true });
}
export function selectedPages(
  value: string | undefined,
  count: number,
  unique = true,
): number[] {
  if (!value || value === "all")
    return Array.from({ length: count }, (_, i) => i);
  const result: number[] = [];
  for (const part of value.replace(/\s/g, "").split(",")) {
    if (!/^\d+(?:-\d+)?$/.test(part))
      throw new Error("Use páginas como 1,3,5-8.");
    const [start, end = start] = part.split("-").map(Number);
    if (start < 1 || end < start || end > count)
      throw new Error(
        `O intervalo ${part} é inválido. Este PDF tem ${count} páginas.`,
      );
    for (let i = start - 1; i < end; i++)
      if (!unique || !result.includes(i)) result.push(i);
  }
  if (!result.length) throw new Error("Selecione pelo menos uma página.");
  return result;
}
function ink(hex = "#204e3e") {
  return rgb(
    ...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ]),
  );
}
async function assemble(parts: Part[]): Promise<Output> {
  if (!parts.length) throw new Error("Nenhum resultado foi gerado.");
  if (parts.length === 1)
    return {
      blob: blob(
        parts[0].data,
        parts[0].name.endsWith(".pdf") ? "application/pdf" : undefined,
      ),
      name: parts[0].name,
      count: 1,
      local: true,
    };
  const files: Record<string, Uint8Array> = {};
  parts.forEach(
    (p, i) => (files[files[p.name] ? `${i + 1}-${p.name}` : p.name] = p.data),
  );
  return {
    blob: blob(zipSync(files), "application/zip"),
    name: "ilovekush-resultados.zip",
    count: parts.length,
    local: true,
  };
}
async function wasm(
  engine: "qpdf" | "gs",
  file: File,
  args: string[],
  extra: { name: string; data: ArrayBuffer }[] = [],
) {
  const worker = new Worker("/pdf-engine.worker.js");
  return new Promise<Uint8Array>(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error("O processamento demorou demais. Tente um documento menor."),
      );
    }, 180_000);
    worker.onmessage = ({ data }) => {
      clearTimeout(timeout);
      worker.terminate();
      data.error
        ? reject(
            new Error(
              data.error.includes("password")
                ? "Confira a senha de abertura do PDF."
                : data.error,
            ),
          )
        : resolve(new Uint8Array(data.data));
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(
        new Error(
          "O motor não conseguiu iniciar. Tente um navegador atualizado.",
        ),
      );
    };
    const data = await file.arrayBuffer();
    worker.postMessage({
      engine,
      files: [{ name: "input.pdf", data }, ...extra],
      args,
    });
  });
}
async function unencrypted(file: File, password: string) {
  const data = await wasm("qpdf", file, [
    `--password=${password}`,
    "--decrypt",
    "/input.pdf",
    "/output.pdf",
  ]);
  return new File([new Uint8Array(data).buffer], file.name, {
    type: "application/pdf",
  });
}
async function getDoc(file: File, options: Options) {
  try {
    return await PDFDocument.load(await bytes(file));
  } catch (error) {
    if (!options.password)
      throw new Error(
        "Não foi possível abrir o PDF. Se ele estiver protegido, informe a senha nas opções.",
      );
    return PDFDocument.load(
      await bytes(await unencrypted(file, options.password)),
    );
  }
}
async function textDocument(text: string, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const face = await font(doc);
  let page = doc.addPage([595, 842]);
  let y = 785;
  const draw = (line: string, size = 11) => {
    if (y < 50) {
      page = doc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(line, { x: 45, y, size, font: face, color: ink() });
    y -= size * 1.55;
  };
  draw(title, 21);
  y -= 15;
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (face.widthOfTextAtSize(`${line} ${word}`, 11) > 505 && line) {
        draw(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    draw(line);
    y -= 5;
  }
  return doc.save();
}

export async function runLocal(
  tool: string,
  files: File[],
  o: Options,
  progress: (text: string) => void,
  assets: Record<string, File> = {},
): Promise<Output> {
  const parts: Part[] = [];
  progress("Preparando seus arquivos…");
  if (tool === "html-pdf") {
    const DOMPurify = (await import("dompurify")).default;
    const html2canvas = (await import("html2canvas")).default;
    const source = o.html || (files[0] ? await files[0].text() : "");
    if (!source.trim()) throw new Error("Cole o HTML ou envie um arquivo.");
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.style.cssText =
      "position:fixed;left:-2000px;top:0;width:794px;height:1123px;border:0;";
    document.body.appendChild(frame);
    try {
      const page = frame.contentDocument!;
      page.open();
      page.write(
        '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:"><body></body>',
      );
      page.close();
      page.body.innerHTML = DOMPurify.sanitize(source, {
        ADD_TAGS: ["style"],
        FORBID_TAGS: [
          "script",
          "iframe",
          "object",
          "embed",
          "link",
          "base",
          "form",
        ],
        FORBID_ATTR: ["srcset"],
      });
      page.body.style.cssText =
        "margin:32px;font:16px sans-serif;color:#222;background:white;";
      const canvas = await html2canvas(page.body, {
        backgroundColor: "#ffffff",
        scale: 1.5,
        useCORS: false,
        allowTaint: false,
      });
      const doc = await PDFDocument.create();
      const ratio = 595 / canvas.width;
      const sliceHeight = Math.floor(842 / ratio);
      for (let y = 0; y < canvas.height; y += sliceHeight) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(sliceHeight, canvas.height - y);
        slice
          .getContext("2d")!
          .drawImage(
            canvas,
            0,
            y,
            canvas.width,
            slice.height,
            0,
            0,
            slice.width,
            slice.height,
          );
        const image = await doc.embedPng(
          await (await fetch(slice.toDataURL())).arrayBuffer(),
        );
        doc
          .addPage([595, 842])
          .drawImage(image, {
            x: 0,
            y: 842 - slice.height * ratio,
            width: 595,
            height: slice.height * ratio,
          });
      }
      return assemble([{ name: "ilovekush-html.pdf", data: await doc.save() }]);
    } finally {
      frame.remove();
    }
  }
  if (tool === "merge") {
    if (files.length < 2) throw new Error("Selecione pelo menos dois PDFs.");
    const target = await PDFDocument.create();
    for (const file of files) {
      const source = await getDoc(file, o);
      const pages = await target.copyPages(source, source.getPageIndices());
      pages.forEach((page) => target.addPage(page));
    }
    return assemble([
      { name: "ilovekush-juntos.pdf", data: await target.save() },
    ]);
  }
  if (tool === "jpg-pdf" || tool === "scan") {
    const doc = await PDFDocument.create();
    for (const file of files) {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(bitmap.width, 3200);
      canvas.height = Math.round((bitmap.height * canvas.width) / bitmap.width);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (tool === "scan" && o.scan_mode === "gray")
        ctx.filter = "grayscale(1) contrast(1.2)";
      if (tool === "scan" && o.scan_mode === "bw")
        ctx.filter = "grayscale(1) contrast(3)";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = await doc.embedJpg(
        await (await fetch(canvas.toDataURL("image/jpeg", 0.92))).arrayBuffer(),
      );
      const dim: [number, number] =
        o.paper === "a4"
          ? o.orientation === "landscape"
            ? [842, 595]
            : [595, 842]
          : [canvas.width * 0.75, canvas.height * 0.75];
      const margin = Number(o.margin ?? 12);
      const scale = Math.min(
        (dim[0] - margin * 2) / image.width,
        (dim[1] - margin * 2) / image.height,
      );
      const page = doc.addPage(dim);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, {
        x: (dim[0] - w) / 2,
        y: (dim[1] - h) / 2,
        width: w,
        height: h,
      });
    }
    return assemble([
      { name: "ilovekush-imagens.pdf", data: await doc.save() },
    ]);
  }
  if (tool === "compare") {
    if (files.length !== 2) throw new Error("Escolha exatamente dois PDFs.");
    const docs = await Promise.all(files.map((f) => loadPdf(f, o.password)));
    const output = await PDFDocument.create();
    const changes: string[] = [];
    for (let i = 1; i <= Math.max(...docs.map((d) => d.numPages)); i++) {
      progress(`Comparando página ${i}…`);
      const page = output.addPage([1200, 850]);
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 850;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f6f5f0";
      ctx.fillRect(0, 0, 1200, 850);
      const images: HTMLCanvasElement[] = [];
      const texts: string[] = [];
      for (let j = 0; j < 2; j++) {
        const img = document.createElement("canvas");
        img.width = 570;
        img.height = 810;
        const c = img.getContext("2d")!;
        c.fillStyle = "white";
        c.fillRect(0, 0, 570, 810);
        if (i <= docs[j].numPages) {
          const rendered = await renderPage(docs[j], i, 570);
          c.drawImage(rendered, 0, 0, 570, Math.min(810, rendered.height));
          texts.push((await pageText(docs[j], i)).map((t) => t.str).join(" "));
        } else texts.push("[Página ausente]");
        images.push(img);
      }
      const a = images[0].getContext("2d")!.getImageData(0, 0, 570, 810);
      const b = images[1].getContext("2d")!.getImageData(0, 0, 570, 810);
      for (let k = 0; k < a.data.length; k += 4)
        if (
          Math.abs(a.data[k] - b.data[k]) +
            Math.abs(a.data[k + 1] - b.data[k + 1]) +
            Math.abs(a.data[k + 2] - b.data[k + 2]) >
          90
        ) {
          b.data[k] = 245;
          b.data[k + 1] *= 0.65;
          b.data[k + 2] *= 0.65;
        }
      images[1].getContext("2d")!.putImageData(b, 0, 0);
      images.forEach((image, j) => ctx.drawImage(image, 20 + j * 590, 30));
      const image = await output.embedPng(
        await (await fetch(canvas.toDataURL())).arrayBuffer(),
      );
      page.drawImage(image, { x: 0, y: 0, width: 1200, height: 850 });
      if (texts[0] !== texts[1])
        changes.push(
          `PÁGINA ${i}\nORIGINAL:\n${texts[0]}\nCOMPARADO:\n${texts[1]}\n`,
        );
    }
    await Promise.all(docs.map((d) => d.destroy()));
    return assemble([
      { name: "comparacao-visual.pdf", data: await output.save() },
      {
        name: "diferencas.txt",
        data: strToU8(
          changes.join("\n") ||
            "Nenhuma diferença de texto encontrada. Confira também a comparação visual.",
        ),
      },
    ]);
  }
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    progress(`Processando ${file.name} (${fi + 1}/${files.length})…`);
    const filename = stem(file);
    if (tool === "redact") {
      const terms = String(o.redact_text || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (!terms.length && !o.boxes?.length)
        throw new Error("Informe um texto ou marque uma região na prévia.");
      const source = await loadPdf(file, o.password);
      const output = await PDFDocument.create();
      let hits = 0;
      try {
        const selected = selectedPages(o.pages, source.numPages);
        for (let i = 0; i < source.numPages; i++) {
          const original = await source.getPage(i + 1);
          const viewport = original.getViewport({ scale: 1 });
          const canvas = await renderPage(source, i + 1, 1600);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#000000";
          if (selected.includes(i)) {
            for (const box of o.boxes || [])
              if (Number(box.page) === i + 1) {
                ctx.fillRect(
                  (box.x / 100) * canvas.width,
                  (box.y / 100) * canvas.height,
                  (box.width / 100) * canvas.width,
                  (box.height / 100) * canvas.height,
                );
                hits++;
              }
            const items = await pageText(source, i + 1);
            const ratio = canvas.width / viewport.width;
            const lines = new Map<number, typeof items>();
            for (const item of items) {
              const key = Math.round(item.transform[5] / 3) * 3;
              const line = lines.get(key) || [];
              line.push(item);
              lines.set(key, line);
            }
            for (const line of lines.values()) {
              const text = line.map((item) => item.str).join(" ");
              if (
                !terms.some((term) =>
                  text.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
                )
              )
                continue;
              const x = Math.min(...line.map((t) => t.transform[4]));
              const y = Math.max(...line.map((t) => t.transform[5] + t.height));
              const right = Math.max(
                ...line.map((t) => t.transform[4] + t.width),
              );
              const bottom = Math.min(
                ...line.map((t) => t.transform[5] - t.height * 0.3),
              );
              ctx.fillRect(
                Math.max(0, x * ratio - 4),
                (viewport.height - y) * ratio - 4,
                (right - x) * ratio + 8,
                (y - bottom) * ratio + 8,
              );
              hits++;
            }
          }
          const image = await output.embedPng(
            await (await fetch(canvas.toDataURL())).arrayBuffer(),
          );
          output
            .addPage([viewport.width, viewport.height])
            .drawImage(image, {
              x: 0,
              y: 0,
              width: viewport.width,
              height: viewport.height,
            });
        }
      } finally {
        await source.destroy();
      }
      if (!hits)
        throw new Error(
          "O texto não foi encontrado. Em documentos digitalizados, marque uma região para censurar.",
        );
      parts.push({
        name: `${filename}-censurado.pdf`,
        data: await output.save(),
      });
      continue;
    }
    if (["compress", "protect", "unlock", "repair"].includes(tool)) {
      let data: Uint8Array;
      if (tool === "compress") {
        const level = (
          {
            low: "/prepress",
            recommended: "/ebook",
            extreme: "/screen",
          } as Record<string, string>
        )[o.level || "recommended"];
        data = await wasm("gs", file, [
          "-sDEVICE=pdfwrite",
          `-dPDFSETTINGS=${level}`,
          "-dCompatibilityLevel=1.7",
          "-dNOPAUSE",
          "-dBATCH",
          "-dSAFER",
          ...(o.password ? [`-sPDFPassword=${o.password}`] : []),
          "-sOutputFile=/output.pdf",
          "/input.pdf",
        ]);
        if (data.byteLength > file.size && !o.password)
          data = await bytes(file);
      } else {
        let args = [`--password=${o.password || ""}`];
        if (tool === "protect") {
          if ((o.new_password || "").length < 4)
            throw new Error("Use uma senha de pelo menos 4 caracteres.");
          args.push("--encrypt", o.new_password, o.new_password, "256", "--");
        }
        if (tool === "unlock") args.push("--decrypt");
        if (tool === "repair") args.push("--object-streams=generate");
        data = await wasm("qpdf", file, [...args, "/input.pdf", "/output.pdf"]);
      }
      parts.push({ name: `${filename}-${tool}.pdf`, data });
      continue;
    }
    if (tool === "pdfa") {
      const icc = await (await fetch("/engines/sRGB.icc")).arrayBuffer();
      const ps = `%!PS-Adobe-3.0\n/ICCProfile (/profile.icc) def\n[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark\n[{icc_PDFA} << /N 3 >> /PUT pdfmark\n[{icc_PDFA} ICCProfile (r) file /PUT pdfmark\n[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark\n[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) >> /PUT pdfmark\n[{Catalog} << /OutputIntents [{OutputIntent_PDFA}] >> /PUT pdfmark\n`;
      const data = await wasm(
        "gs",
        file,
        [
          "-dPDFA=2",
          "-dBATCH",
          "-dNOPAUSE",
          "-dSAFER",
          "--permit-file-read=/profile.icc",
          "-sDEVICE=pdfwrite",
          "-sColorConversionStrategy=RGB",
          "-dPDFACompatibilityPolicy=1",
          "-sOutputFile=/output.pdf",
          "/definition.ps",
          "/input.pdf",
        ],
        [
          { name: "profile.icc", data: icc },
          { name: "definition.ps", data: new TextEncoder().encode(ps).buffer },
        ],
      );
      parts.push({ name: `${filename}-pdfa.pdf`, data });
      continue;
    }
    if (
      [
        "pdf-jpg",
        "extract",
        "markdown",
        "summarize",
        "smart-split",
        "pdf-word",
        "pdf-excel",
        "pdf-powerpoint",
        "ocr",
      ].includes(tool)
    ) {
      const source = await loadPdf(file, o.password);
      try {
        const selected = selectedPages(o.pages, source.numPages);
        if (tool === "pdf-jpg") {
          if (o.image_mode === "extract")
            throw new Error(
              "Para extrair imagens incorporadas, escolha o processamento no servidor. No dispositivo, use Converter páginas.",
            );
          for (const i of selected) {
            const canvas = await renderPage(
              source,
              i + 1,
              Number(o.dpi || 150) * 8.27,
            );
            const data = new Uint8Array(
              await (
                await fetch(canvas.toDataURL("image/jpeg", 0.92))
              ).arrayBuffer(),
            );
            parts.push({ name: `${filename}-pagina-${i + 1}.jpg`, data });
          }
        } else if (tool === "ocr") {
          const tesseract = await import("tesseract.js");
          const createWorker =
            tesseract.createWorker || tesseract.default.createWorker;
          const worker = await createWorker(o.language || "por+eng", 1, {
            workerPath: `${location.origin}/engines/ocr/worker.min.js`,
            corePath: `${location.origin}/engines/ocr`,
            langPath: `${location.origin}/engines/ocr`,
            workerBlobURL: false,
            logger: (event) =>
              progress(
                event.status === "recognizing text"
                  ? `Reconhecendo texto: ${Math.round(event.progress * 100)}%`
                  : "Preparando reconhecimento de texto…",
              ),
          });
          try {
            const output = await PDFDocument.create();
            const face = await font(output);
            for (const i of Array.from(
              { length: source.numPages },
              (_, i) => i,
            )) {
              const original = await source.getPage(i + 1);
              const viewport = original.getViewport({ scale: 1 });
              const canvas = await renderPage(source, i + 1, 1400);
              const { data } = await worker.recognize(
                canvas,
                {},
                { blocks: true, text: true },
              );
              const page = output.addPage([viewport.width, viewport.height]);
              const image = await output.embedPng(
                await (await fetch(canvas.toDataURL())).arrayBuffer(),
              );
              page.drawImage(image, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height,
              });
              const ratio = viewport.width / canvas.width;
              for (const block of data.blocks || [])
                for (const paragraph of block.paragraphs)
                  for (const line of paragraph.lines)
                    for (const word of line.words) {
                      const size = Math.max(
                        4,
                        (word.bbox.y1 - word.bbox.y0) * ratio,
                      );
                      page.drawText(word.text, {
                        x: word.bbox.x0 * ratio,
                        y: viewport.height - word.bbox.y1 * ratio,
                        size,
                        font: face,
                        opacity: 0,
                      });
                    }
            }
            parts.push({
              name: `${filename}-ocr.pdf`,
              data: await output.save(),
            });
          } finally {
            await worker.terminate();
          }
        } else if (tool === "pdf-powerpoint") {
          const PptxGenJS = (await import("pptxgenjs")).default;
          const pptx = new PptxGenJS();
          pptx.layout = "LAYOUT_WIDE";
          for (let i = 1; i <= source.numPages; i++) {
            const canvas = await renderPage(source, i, 1400);
            const slide = pptx.addSlide();
            const scale = Math.min(13.333 / canvas.width, 7.5 / canvas.height);
            slide.addImage({
              data: canvas.toDataURL(),
              x: (13.333 - canvas.width * scale) / 2,
              y: (7.5 - canvas.height * scale) / 2,
              w: canvas.width * scale,
              h: canvas.height * scale,
            });
          }
          parts.push({
            name: `${filename}.pptx`,
            data: new Uint8Array(
              (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer,
            ),
          });
        } else {
          const texts: string[] = [];
          const detailed: any[] = [];
          for (let i = 1; i <= source.numPages; i++) {
            const items = await pageText(source, i);
            texts.push(
              items.map((t) => t.str + (t.hasEOL ? "\n" : " ")).join(""),
            );
            detailed.push({
              page: i,
              items: items.map((t) => ({
                text: t.str,
                x: t.transform[4],
                y: t.transform[5],
                width: t.width,
                height: t.height,
              })),
            });
          }
          const text = texts.join("\n\n");
          if (!text.trim())
            throw new Error(
              "Este documento precisa de OCR antes de extrair seu texto.",
            );
          if (tool === "pdf-word") {
            const { Document, Packer, Paragraph, TextRun } = await import(
              "docx"
            );
            const doc = new Document({
              sections: texts.map((t) => ({
                children: t
                  .split("\n")
                  .map(
                    (line) => new Paragraph({ children: [new TextRun(line)] }),
                  ),
              })),
            });
            parts.push({
              name: `${filename}.docx`,
              data: new Uint8Array(
                await (await Packer.toBlob(doc)).arrayBuffer(),
              ),
            });
          } else if (tool === "pdf-excel") {
            const ExcelJS = (await import("exceljs")).default;
            const workbook = new ExcelJS.Workbook();
            detailed.forEach(({ items }, i) => {
              const sheet = workbook.addWorksheet(`Página ${i + 1}`);
              const rows = new Map<number, any[]>();
              items.forEach((t: any) => {
                const key = Math.round(t.y / 4) * 4;
                const row = rows.get(key) || [];
                row.push(t);
                rows.set(key, row);
              });
              [...rows.entries()]
                .sort((a, b) => b[0] - a[0])
                .forEach(([, values]) =>
                  sheet.addRow(
                    values.sort((a, b) => a.x - b.x).map((t) => t.text),
                  ),
                );
              sheet.columns.forEach((c) => (c.width = 24));
            });
            parts.push({
              name: `${filename}.xlsx`,
              data: new Uint8Array(await workbook.xlsx.writeBuffer()),
            });
          } else if (tool === "summarize") {
            const sentences = text
              .match(/[^.!?\n]+[.!?]?/g)
              ?.map((s) => s.trim())
              .filter((s) => s.length > 25) || [text];
            const stop = new Set(
              "de da do das dos a o as os e em um uma para por com que é se não no na the of and is to in for on".split(
                " ",
              ),
            );
            const frequencies = new Map<string, number>();
            const words = (s: string) =>
              s
                .toLowerCase()
                .match(/[\p{L}]{3,}/gu)
                ?.filter((w) => !stop.has(w)) || [];
            sentences.forEach((s) =>
              words(s).forEach((w) =>
                frequencies.set(w, (frequencies.get(w) || 0) + 1),
              ),
            );
            const ranked = sentences
              .map((s, i) => ({
                s,
                i,
                score:
                  words(s).reduce(
                    (sum, w) => sum + (frequencies.get(w) || 0),
                    0,
                  ) / Math.max(1, words(s).length),
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, Number(o.sentences || 6))
              .sort((a, b) => a.i - b.i);
            const summary = ranked.map((x) => x.s).join("\n\n");
            parts.push({
              name: `${filename}-resumo.${o.output === "txt" ? "txt" : "pdf"}`,
              data:
                o.output === "txt"
                  ? strToU8(summary)
                  : await textDocument(summary, "Resumo do documento"),
            });
          } else if (tool === "smart-split") {
            if (!o.keyword?.trim())
              throw new Error(
                "Informe a palavra ou o título que inicia uma seção.",
              );
            const boundaries = [
              0,
              ...texts.flatMap((t, i) =>
                i > 0 &&
                t.toLocaleLowerCase().includes(o.keyword.toLocaleLowerCase())
                  ? [i]
                  : [],
              ),
              texts.length,
            ];
            if (boundaries.length === 2)
              throw new Error(
                "Nenhuma nova seção corresponde à palavra informada.",
              );
            const original = await getDoc(file, o);
            for (let i = 0; i < boundaries.length - 1; i++) {
              const part = await PDFDocument.create();
              const copied = await part.copyPages(
                original,
                Array.from(
                  { length: boundaries[i + 1] - boundaries[i] },
                  (_, j) => j + boundaries[i],
                ),
              );
              copied.forEach((p) => part.addPage(p));
              parts.push({
                name: `${filename}-secao-${i + 1}.pdf`,
                data: await part.save(),
              });
            }
          } else
            parts.push({
              name: `${filename}.${tool === "markdown" ? "md" : o.detailed ? "json" : "txt"}`,
              data: strToU8(
                tool === "markdown"
                  ? texts
                      .map((t, i) => `## Página ${i + 1}\n\n${t}`)
                      .join("\n\n---\n\n")
                  : o.detailed
                    ? JSON.stringify(detailed, null, 2)
                    : text,
              ),
            });
        }
      } finally {
        await source.destroy();
      }
      continue;
    }
    const doc = await getDoc(file, o);
    const selected = selectedPages(o.pages, doc.getPageCount());
    if (tool === "split" || tool === "organize") {
      let groups: number[][] = [];
      if (tool === "organize")
        groups = [selectedPages(o.order || o.pages, doc.getPageCount(), false)];
      else if (o.split_mode === "ranges") {
        groups = String(o.ranges || "")
          .split(";")
          .filter((x) => x.trim())
          .map((x) => selectedPages(x.trim(), doc.getPageCount()));
        if (!groups.length) throw new Error("Informe intervalos como 1-3;4-6.");
      } else if (o.split_mode === "extract") groups = [selected];
      else if (o.split_mode === "remove")
        groups = [doc.getPageIndices().filter((i) => !selected.includes(i))];
      else if (o.split_mode === "fixed") {
        const size = Number(o.group_size || 1);
        if (!Number.isInteger(size) || size < 1)
          throw new Error("O tamanho do grupo deve ser um inteiro positivo.");
        for (let i = 0; i < doc.getPageCount(); i += size)
          groups.push(
            Array.from(
              { length: Math.min(size, doc.getPageCount() - i) },
              (_, j) => i + j,
            ),
          );
      } else groups = selected.map((i) => [i]);
      for (let i = 0; i < groups.length; i++) {
        if (!groups[i].length)
          throw new Error("O documento não pode ficar sem páginas.");
        const part = await PDFDocument.create();
        // Separate copies are essential: repeated indices must not share a page reference.
        for (const index of groups[i]) {
          const [page] = await part.copyPages(doc, [index]);
          part.addPage(page);
        }
        parts.push({
          name: `${filename}-parte-${i + 1}.pdf`,
          data: await part.save(),
        });
      }
      continue;
    }
    if (tool === "forms") {
      const form = doc.getForm();
      const face = await font(doc);
      for (const field of form.getFields()) {
        const value = (o.fields || {})[field.getName()];
        if (value === undefined) continue;
        if (field instanceof PDFTextField) field.setText(String(value));
        else if (field instanceof PDFCheckBox)
          value ? field.check() : field.uncheck();
        else if (field instanceof PDFDropdown || field instanceof PDFOptionList)
          field.select(String(value));
      }
      form.updateFieldAppearances(face);
      if (o.flatten) form.flatten();
    } else
      for (const i of selected) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();
        const size = Number(o.font_size || (tool === "watermark" ? 32 : 16));
        const face = ["edit", "sign", "watermark", "pagenumber"].includes(tool)
          ? await font(doc)
          : undefined;
        if (tool === "rotate")
          page.setRotation(
            degrees((page.getRotation().angle + Number(o.angle || 90)) % 360),
          );
        if (tool === "crop") {
          const margin = Number(o.crop_margin ?? 24);
          if (margin < 0 || margin * 2 >= Math.min(width, height))
            throw new Error("A margem está fora dos limites da página.");
          page.setCropBox(
            margin,
            margin,
            width - margin * 2,
            height - margin * 2,
          );
        }
        if (tool === "pagenumber") {
          const text = String(o.format || "{n} / {total}")
            .replaceAll("{n}", String(Number(o.start || 1) + i))
            .replaceAll("{total}", String(doc.getPageCount()));
          const w = face!.widthOfTextAtSize(text, 11);
          page.drawText(text, {
            x: (width - w) / 2,
            y: o.position === "top" ? height - 30 : 25,
            size: 11,
            font: face!,
            color: ink(o.color),
          });
        }
        if (["edit", "sign", "watermark"].includes(tool)) {
          if (o.find)
            throw new Error(
              "Para substituir texto existente, use o processamento no servidor. Neste dispositivo, você pode adicionar texto e imagens.",
            );
          const x = (Number(o.x ?? 10) / 100) * width;
          const y =
            height -
            (Number(o.y ?? (tool === "sign" ? 80 : 12)) / 100) * height -
            size;
          const imageFile = tool === "sign" ? assets.signature : assets.image;
          if (imageFile) {
            const bitmap = await createImageBitmap(imageFile);
            const c = document.createElement("canvas");
            c.width = bitmap.width;
            c.height = bitmap.height;
            c.getContext("2d")!.drawImage(bitmap, 0, 0);
            bitmap.close();
            const image = await doc.embedPng(
              await (await fetch(c.toDataURL())).arrayBuffer(),
            );
            const w = Math.min(width * 0.5, tool === "watermark" ? 260 : 200);
            const h = (w * image.height) / image.width;
            page.drawImage(image, {
              x: tool === "watermark" ? (width - w) / 2 : x,
              y: tool === "watermark" ? (height - h) / 2 : y - h + size,
              width: w,
              height: h,
              opacity: tool === "watermark" ? Number(o.opacity ?? 30) / 100 : 1,
            });
          } else {
            if (!o.text?.trim())
              throw new Error("Escreva um texto ou envie uma imagem.");
            const textWidth = face!.widthOfTextAtSize(o.text, size);
            if (textWidth > width - (tool === "watermark" ? 40 : x + 15))
              throw new Error(
                "O texto é largo demais. Diminua a fonte ou divida em linhas.",
              );
            page.drawText(o.text, {
              x:
                tool === "watermark"
                  ? Math.max(20, (width - textWidth) / 2)
                  : x,
              y: tool === "watermark" ? height / 2 : y,
              size,
              font: face!,
              color: ink(o.color),
              opacity: tool === "watermark" ? Number(o.opacity ?? 30) / 100 : 1,
              lineHeight: size * 1.4,
            });
          }
        }
      }
    parts.push({ name: `${filename}-${tool}.pdf`, data: await doc.save() });
  }
  return assemble(parts);
}

export async function runServer(
  tool: string,
  files: File[],
  options: Options,
  assets: Record<string, File>,
  signal: AbortSignal,
): Promise<Output> {
  const data = new FormData();
  files.forEach((file) => data.append("files", file));
  data.append("options", JSON.stringify(options));
  Object.entries(assets).forEach(([name, file]) => data.append(name, file));
  const endpoint = ["word-pdf", "excel-pdf", "powerpoint-pdf"].includes(tool)
    ? "/api/office"
    : `/api/process/${tool}`;
  const response = await fetch(endpoint, {
    method: "POST",
    body: data,
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail ||
        (response.status === 413
          ? "O servidor aceita arquivos menores. Use uma ferramenta com processamento neste dispositivo."
          : "O servidor não conseguiu processar o documento."),
    );
  }
  const name = decodeURIComponent(
    response.headers
      .get("content-disposition")
      ?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ||
      response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ||
      "ilovekush-resultado.pdf",
  );
  return {
    blob: await response.blob(),
    name,
    count: Number(response.headers.get("x-kush-output-count") || 1),
    local: false,
  };
}
