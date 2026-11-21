import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend serves this build (web/dist) at /app and returns index.html for
// every unknown path under /app/, so the app uses ordinary History-API URLs.
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
  },
  server: {
    // `npm run dev` against a local backend: forward the API to it.
    proxy: { "/api": "http://127.0.0.1:8081" },
  },
});
