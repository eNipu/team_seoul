import { existsSync } from "node:fs";

if (!existsSync(new URL("../app/venn-kit.css", import.meta.url))) {
  console.error("sync-kit: the site-owned app/venn-kit.css is missing.");
  process.exitCode = 1;
}
