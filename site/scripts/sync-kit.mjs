// Copies the shared design kit from the widget into the site before a build, so the
// cards on the landing page and the cards inside ChatGPT use one stylesheet.
//
// When the site is deployed on its own (Railway uploads site/ as the root), the
// widget folder is not there and the committed copy is used as it is.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../widget/src/venn-kit.css", import.meta.url));
const target = fileURLToPath(new URL("../app/venn-kit.css", import.meta.url));

if (!existsSync(source)) {
  if (!existsSync(target)) {
    console.error("sync-kit: app/venn-kit.css is missing and the widget copy is not available.");
    process.exit(1);
  }
  console.log("sync-kit: widget not present, using the committed app/venn-kit.css");
} else {
  const kit = readFileSync(source, "utf8");
  if (!existsSync(target) || readFileSync(target, "utf8") !== kit) {
    writeFileSync(target, kit);
    console.log("sync-kit: app/venn-kit.css updated from widget/src/venn-kit.css");
  } else {
    console.log("sync-kit: app/venn-kit.css is up to date");
  }
}
