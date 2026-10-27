import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const excluded = new Set([
  ".git",
  "node_modules",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".data",
  ".tools",
  ".vercel",
  "artifacts",
  "dist",
  ".agents",
  ".aws",
  ".codex",
]);
const files = {};
async function visit(directory) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
  });
  for (const entry of entries.sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    const relative = path.posix.join(directory, entry.name);
    if (
      entry.isSymbolicLink() ||
      excluded.has(entry.name) ||
      relative === "public/engines"
    )
      continue;
    if (entry.isDirectory()) {
      await visit(relative);
    } else if (
      entry.isFile() &&
      relative !== "release-manifest.json" &&
      entry.name !== ".DS_Store" &&
      !entry.name.startsWith(".env") &&
      !/\.(pyc|tsbuildinfo|log|zip)$/.test(entry.name)
    ) {
      const data = await readFile(path.join(root, relative));
      files[relative] = createHash("sha256").update(data).digest("hex");
    }
  }
}
await visit("");
const { versao } = JSON.parse(
  await readFile(path.join(root, "public/versao.json"), "utf8"),
);
await writeFile(
  path.join(root, "release-manifest.json"),
  JSON.stringify({ versao, files }, null, 2) + "\n",
);
console.log(
  `Manifesto criado: ${versao} (${Object.keys(files).length} arquivos).`,
);
