import { createServer } from "node:http";
import handler from "../api/office.mjs";
createServer((req, res) => {
  handler(req, res).catch(() => {
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end("Falha ao converter o documento.");
    }
  });
}).listen(Number(process.env.KUSH_OFFICE_PORT || 8002), "127.0.0.1", () => console.log("Office API iniciada"));
