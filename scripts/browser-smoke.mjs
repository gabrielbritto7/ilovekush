import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";

const url = process.env.KUSH_TEST_URL || "http://127.0.0.1:5173";
const fixtureDir = "/tmp/kush-fixtures";
const output = path.resolve("artifacts/browser");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".tool-card").count(), 35);
  await page.getByRole("textbox", { name: "Buscar ferramenta" }).fill("juntar");
  assert.equal(await page.locator(".tool-card").count(), 1);
  await page
    .getByRole("button", { name: "Adicionar Juntar PDF aos favoritos" })
    .click();
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: "Remover Juntar PDF dos favoritos" })
      .count(),
    1,
  );
  await page.screenshot({
    path: path.join(output, "inicio-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(output, "inicio-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${url}/ferramenta/merge`);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([`${fixtureDir}/sample.pdf`, `${fixtureDir}/other.pdf`]);
  assert.equal(await page.locator(".file-row").count(), 2);
  await page.screenshot({
    path: path.join(output, "juntar-arquivos.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Juntar PDF", exact: true }).click();
  await page.getByText("Seu arquivo está pronto!").waitFor();
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo/ }).click();
  const download = await event;
  const mergedPath = path.join(output, "ui-merged.pdf");
  await download.saveAs(mergedPath);
  assert.equal(
    (await PDFDocument.load(await fs.readFile(mergedPath))).getPageCount(),
    4,
  );
  await page.goto(`${url}/ferramenta/watermark`);
  const text = page.getByRole("textbox", { name: "Seu texto", exact: true });
  await text.pressSequentially("Texto completo sem perder foco", { delay: 15 });
  assert.equal(await text.inputValue(), "Texto completo sem perder foco");
  await page.goto(url);
  const fixtures = Object.fromEntries(
    await Promise.all(
      [
        "sample.pdf",
        "other.pdf",
        "image.png",
        "sample.docx",
        "sample.xlsx",
        "sample.pptx",
        "scan.pdf",
      ].map(async (name) => [
        name,
        (await fs.readFile(`${fixtureDir}/${name}`)).toString("base64"),
      ]),
    ),
  );
  if (process.env.KUSH_TEST_PRODUCTION === "1") {
    await page.goto(`${url}/tests/harness.html`);
    await page.waitForFunction(() => window.kushTestReady);
  }
  await page.evaluate((fixtures) => {
    window.kushTestFixtures = Object.fromEntries(
      Object.entries(fixtures).map(([name, value]) => [
        name,
        Uint8Array.from(atob(value), (x) => x.charCodeAt(0)),
      ]),
    );
  }, fixtures);
  const cases = [
    ["split", ["sample.pdf"], { split_mode: "ranges", ranges: "1-2;3" }],
    ["organize", ["sample.pdf"], { order: "3,1,1" }],
    ["rotate", ["sample.pdf"], { angle: 90, pages: "2" }],
    ["protect", ["sample.pdf"], { new_password: "browser-test" }],
    ["compress", ["sample.pdf"], { level: "recommended" }],
    ["jpg-pdf", ["image.png"], { paper: "a4" }],
    ["pagenumber", ["sample.pdf"], { format: "Page {n} of {total}", start: 1 }],
    ["watermark", ["sample.pdf"], { text: "CONFIDENTIAL", font_size: 24 }],
    ["redact", ["sample.pdf"], { redact_text: "SECRET-123" }],
    ["pdf-jpg", ["sample.pdf"], { pages: "1", dpi: 72 }],
    ["extract", ["sample.pdf"], {}],
    ["summarize", ["sample.pdf"], { output: "txt", sentences: 2 }],
    ["smart-split", ["sample.pdf"], { keyword: "Chapter" }],
    ["pdf-word", ["sample.pdf"], {}],
    ["pdf-excel", ["sample.pdf"], {}],
    ["pdf-powerpoint", ["sample.pdf"], {}],
    ["compare", ["sample.pdf", "other.pdf"], {}],
    ["pdfa", ["sample.pdf"], {}],
    ["ocr", ["scan.pdf"], { language: "eng" }],
    ["word-pdf", ["sample.docx"], {}],
    ["excel-pdf", ["sample.xlsx"], {}],
    ["powerpoint-pdf", ["sample.pptx"], {}],
    [
      "html-pdf",
      [],
      { html: "<h1>HTML Test</h1><p>A meaningful document.</p>" },
    ],
  ];
  for (const [tool, names, options] of cases) {
    const result = await page.evaluate(
      async ({ tool, names, options }) => {
        const runLocal =
          window.kushTestRun || (await import("/src/engine.ts")).runLocal;
        const files = names.map(
          (name) =>
            new File([window.kushTestFixtures[name]], name, {
              type: name.endsWith(".pdf") ? "application/pdf" : undefined,
            }),
        );
        const result = ["word-pdf", "excel-pdf", "powerpoint-pdf"].includes(
          tool,
        )
          ? await window.kushTestServer(
              tool,
              files,
              options,
              {},
              new AbortController().signal,
            )
          : await runLocal(tool, files, options, () => {});
        const data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(result.blob);
        });
        return { name: result.name, data, count: result.count };
      },
      { tool, names, options },
    );
    const data = Buffer.from(result.data, "base64");
    assert.ok(data.length > 10, tool);
    await fs.writeFile(path.join(output, `${tool}-${result.name}`), data);
    if (tool === "split") assert.equal(Object.keys(unzipSync(data)).length, 2);
    if (tool === "smart-split")
      assert.equal(Object.keys(unzipSync(data)).length, 3);
    if (tool === "extract")
      assert.match(new TextDecoder().decode(data), /Chapter 3/);
    if (["pdf-word", "pdf-excel", "pdf-powerpoint"].includes(tool))
      assert.ok(unzipSync(data)["[Content_Types].xml"]);
    if (result.name.endsWith(".pdf") && tool !== "protect")
      assert.ok((await PDFDocument.load(data)).getPageCount() > 0);
    console.log(`PASS browser ${tool} (${data.length} bytes)`);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS UI: catalog, search, persistent favorites, mobile layout, upload, processing, download, input focus.",
  );
} finally {
  await browser.close();
}
