import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds a single self-contained dist/index.html (all JS/CSS inlined) that the
// Python MCP server serves as the `ui://heldly/app-v4.html` resource.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
  },
});
