import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(
  new URL("../src-tauri/target/release/bundle/", import.meta.url),
);
const lines = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.name.endsWith(".app")) walk(file);
    else if (entry.isFile() && /\.(dmg|exe|AppImage)$/.test(entry.name))
      lines.push(
        `${createHash("sha256").update(fs.readFileSync(file)).digest("hex")}  ${path.relative(root, file).split(path.sep).join("/")}`,
      );
  }
}
walk(root);
if (!lines.length) throw new Error("No installers were built");
fs.writeFileSync(
  path.join(root, "SHA256SUMS.txt"),
  lines.sort().join("\n") + "\n",
);
