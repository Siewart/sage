import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const web = new URL("../apps/web/", import.meta.url);
const requireWeb = createRequire(new URL("package.json", web));
const children = [
  spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(
        new URL("../apps/local-service/src/index.ts", import.meta.url),
      ),
    ],
    { cwd: fileURLToPath(root), stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      requireWeb.resolve("next/dist/bin/next"),
      process.argv.includes("--production") ? "start" : "dev",
      "--hostname",
      "127.0.0.1",
    ],
    { cwd: fileURLToPath(web), stdio: "inherit" },
  ),
];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
  const timer = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL");
  }, 7000);
  timer.unref();
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    close(1);
  });
  child.on("exit", (code) => close(code ?? 1));
}
process.on("SIGINT", () => close());
process.on("SIGTERM", () => close());
