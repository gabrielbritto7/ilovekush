import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export async function loadPdf(file: File, password = "") {
  return pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password,
  }).promise;
}
export async function renderPage(
  doc: Awaited<ReturnType<typeof loadPdf>>,
  index: number,
  width = 700,
) {
  const page = await doc.getPage(index);
  const viewport = page.getViewport({
    scale: width / page.getViewport({ scale: 1 }).width,
  });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({
    canvas,
    canvasContext: canvas.getContext("2d")!,
    viewport,
  }).promise;
  return canvas;
}
export async function pageText(
  doc: Awaited<ReturnType<typeof loadPdf>>,
  index: number,
) {
  const content = await (await doc.getPage(index)).getTextContent();
  return content.items.filter(
    (item): item is import("pdfjs-dist/types/src/display/api").TextItem =>
      "str" in item,
  );
}
