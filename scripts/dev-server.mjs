import { spawn } from "node:child_process";
const children = [
  spawn(
    ".venv/bin/python",
    ["-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"],
    { stdio: "inherit" },
  ),
  spawn(process.execPath, ["scripts/office-server.mjs"], { stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
});
