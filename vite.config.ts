import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input:
        process.env.KUSH_E2E === "1"
          ? {
              main: path.resolve("index.html"),
              harness: path.resolve("tests/harness.html"),
            }
          : path.resolve("index.html"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: process.env.KUSH_E2E === "1" ? false : undefined,
    watch: {
      ignored: [
        "**/artifacts/**",
        "**/.tools/**",
        "**/.data/**",
        "**/backend/**",
      ],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api/office": "http://127.0.0.1:8002",
      "/api": "http://127.0.0.1:8000",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api/office": "http://127.0.0.1:8002",
      "/api": "http://127.0.0.1:8000",
    },
  },
});
