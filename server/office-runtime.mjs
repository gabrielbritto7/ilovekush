import { fork } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";

// The upstream 2.7.2 parent keeps request timers alive and can hang on destroy.
// Own the child and its timeouts; the unmodified, pinned upstream worker does conversion.
const require = createRequire(import.meta.url);
const packageDir = path.dirname(
  require.resolve("@matbee/libreoffice-converter/package.json"),
);
export class OfficeRuntime {
  pending = new Map();
  child;
  async initialize() {
    this.child = fork(path.join(packageDir, "dist/subprocess.worker.cjs"), [], {
      execArgv: [],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: {
        ...process.env,
        WASM_PATH: path.join(packageDir, "wasm"),
        VERBOSE: "false",
      },
    });
    this.child.on("message", (message) => {
      if (message.type !== "response") return;
      const entry = this.pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(message.id);
      message.success
        ? entry.resolve(message.data)
        : entry.reject(
            new Error("Não foi possível converter este documento Office."),
          );
    });
    this.child.on("exit", () => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error("O conversor Office foi encerrado."));
      }
      this.pending.clear();
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("O conversor Office não iniciou a tempo.")),
        30000,
      );
      this.child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      const ready = (message) => {
        if (message.type === "ready") {
          clearTimeout(timer);
          this.child.off("message", ready);
          resolve();
        } else if (message.type === "error") {
          clearTimeout(timer);
          reject(new Error("O motor Office não pôde ser iniciado."));
        }
      };
      this.child.on("message", ready);
    });
    await this.request("init", undefined, 120000);
  }
  request(type, payload, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error("A conversão demorou demais. Tente um documento menor."),
        );
        this.close();
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.child.send({ type, id, payload }, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }
  async convert(data, extension) {
    const output = await this.request("convert", {
      inputData: Array.from(data),
      inputExt: extension,
      outputFormat: "pdf",
      filterOptions: "",
    });
    return Buffer.from(output);
  }
  close() {
    if (this.child && !this.child.killed) this.child.kill("SIGKILL");
  }
}
