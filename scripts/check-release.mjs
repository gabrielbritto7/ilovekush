import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
try {
  const manifest = JSON.parse(
    await readFile(path.join(root, "release-manifest.json"), "utf8"),
  );
  const missing = [];
  const different = [];
  // Diagnóstico manual da interface; este script não participa de npm run build.
  // Documentação, testes e configuração de hospedagem não definem sua versão.
  const expectedFiles = Object.entries(manifest.files).filter(
    ([file]) =>
      file === "index.html" ||
      file.startsWith("src/") ||
      file === "public/versao.json",
  );
  for (const [file, expected] of expectedFiles) {
    try {
      const data = await readFile(path.join(root, file));
      if (createHash("sha256").update(data).digest("hex") !== expected) {
        different.push(file);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      missing.push(file);
    }
  }
  if (missing.length || different.length) {
    console.error(
      `\nUpload incompleto ou arquivos de versões diferentes (${manifest.versao}).`,
    );
    if (missing.length)
      console.error(
        "Arquivos ausentes:\n" + missing.map((file) => `  ${file}`).join("\n"),
      );
    if (different.length)
      console.error(
        "Arquivos diferentes do pacote:\n" +
          different.map((file) => `  ${file}`).join("\n"),
      );
    console.error(
      "Confira index.html, a pasta src e public/versao.json da mesma entrega, preservando os caminhos.",
    );
    console.error(
      "Se você editou os fontes intencionalmente, gere o manifesto com npm run release:manifest antes de repetir este diagnóstico manual.\n",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Diagnóstico manual da interface: ${manifest.versao} (${expectedFiles.length} arquivos conferidos).`,
    );
  }
} catch (error) {
  console.error(
    "Não foi possível verificar o pacote completo. Envie release-manifest.json e a pasta scripts da mesma entrega.",
  );
  console.error(error.message);
  process.exitCode = 1;
}
