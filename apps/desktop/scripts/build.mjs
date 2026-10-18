import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { build } from "esbuild";
import os from "node:os";
import { createHash } from "node:crypto";
const desktop = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const repo = path.resolve(desktop, "../..");
const icon = spawnSync(
  process.execPath,
  [
    path.join(desktop, "node_modules/@tauri-apps/cli/tauri.js"),
    "icon",
    path.join(desktop, "assets/icon.svg"),
    "--output",
    path.join(desktop, "src-tauri/icons"),
  ],
  { stdio: "inherit" },
);
if (icon.status !== 0) throw new Error("Cannot generate desktop icons");
const stage = path.join(desktop, "stage"),
  runtime = path.join(stage, "runtime");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(runtime, { recursive: true });
if (!process.argv.includes("--runtime-only")) {
  const next = createRequire(path.join(repo, "apps/web/package.json")).resolve(
    "next/dist/bin/next",
  );
  const result = spawnSync(process.execPath, [next, "build"], {
    cwd: path.join(repo, "apps/web"),
    env: { ...process.env, SAGE_DESKTOP_BUILD: "1" },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const common = {
  bundle: true,
  platform: "node",
  target: "node24",
  logLevel: "warning",
  metafile: true,
  external: ["@duckdb/node-api"],
  banner: {
    js: 'import { createRequire as __sageCreateRequire } from "node:module"; const require = __sageCreateRequire(import.meta.url);',
  },
};
const inputFiles = new Set();
for (const [entry, outfile] of [
  ["apps/local-service/src/index.ts", "service.mjs"],
  ["apps/local-service/src/worker.ts", "worker.mjs"],
]) {
  const result = await build({
    ...common,
    entryPoints: [path.join(repo, entry)],
    format: "esm",
    outfile: path.join(runtime, outfile),
  });
  for (const input of Object.keys(result.metafile.inputs))
    inputFiles.add(path.resolve(input));
}
fs.copyFileSync(
  path.join(desktop, "src/bootstrap.mjs"),
  path.join(runtime, "bootstrap.mjs"),
);
fs.cpSync(path.join(repo, "apps/web/out"), path.join(runtime, "web"), {
  recursive: true,
});
fs.copyFileSync(
  path.join(repo, "packages/sage-data/src/duckdb/worker.mjs"),
  path.join(runtime, "duckdb-worker.mjs"),
);
const assets = path.join(runtime, "assets");
for (const relative of [
  "packages/sage-core/data",
  "packages/sage-data/src/default-layout.json",
]) {
  const target = path.join(assets, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(repo, relative), target, { recursive: true });
}
fs.copyFileSync(
  path.join(repo, "packages/simplenlg-core/src/lexicon/default-lexicon.xml"),
  path.join(assets, "default-lexicon.xml"),
);
fs.copyFileSync(
  path.join(repo, "packages/simplenlg-core/LexAccessCopyright.MD"),
  path.join(assets, "LexAccessCopyright.MD"),
);
fs.writeFileSync(
  path.join(assets, "version.txt"),
  process.env.SAGE_BUILD_COMMIT ??
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    }).trim(),
);
const copied = new Set();
function copyPackage(name, req) {
  if (copied.has(name)) return;
  const manifest = req.resolve(name + "/package.json"),
    source = path.dirname(manifest),
    metadata = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const target = path.join(runtime, "node_modules", name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    dereference: true,
    filter: (entry) =>
      !entry.slice(source.length).split(path.sep).includes("node_modules"),
  });
  copied.add(name);
  const local = createRequire(manifest);
  for (const dependency of Object.keys(metadata.dependencies ?? {}))
    copyPackage(dependency, local);
  for (const optional of Object.keys(metadata.optionalDependencies ?? {})) {
    if (
      optional.startsWith("@duckdb/node-bindings-") &&
      optional !== `@duckdb/node-bindings-${process.platform}-${process.arch}`
    )
      continue;
    try {
      local.resolve(optional + "/package.json");
    } catch {
      continue;
    }
    copyPackage(optional, local);
  }
}
copyPackage(
  "@duckdb/node-api",
  createRequire(path.join(repo, "packages/sage-data/package.json")),
);
fs.writeFileSync(path.join(runtime, "package.json"), '{"type":"module"}\n');
console.log(
  `Packaged runtime: ${stage}; native dependencies: ${[...copied].join(", ")}`,
);

// Bundle a verified official Node binary as Tauri's private sidecar. Users do not install Node.
const nodePlatform = process.platform === "win32" ? "win" : process.platform;
const version = "24.13.1",
  archiveName = `node-v${version}-${nodePlatform}-${process.arch}.${process.platform === "win32" ? "zip" : "tar.gz"}`;
const cache = path.join(os.tmpdir(), "sage-node-runtime", version);
fs.mkdirSync(cache, { recursive: true });
const archive = path.join(cache, archiveName),
  base = `https://nodejs.org/dist/v${version}/`;
const sumsResponse = await fetch(base + "SHASUMS256.txt");
if (!sumsResponse.ok) throw new Error("Cannot obtain Node runtime checksums");
const sumLine = (await sumsResponse.text())
  .split("\n")
  .find((line) => line.trim().endsWith("  " + archiveName));
if (!sumLine) throw new Error("Unsupported desktop runtime platform");
const expected = sumLine.trim().split(/\s+/)[0];
if (
  !fs.existsSync(archive) ||
  createHash("sha256").update(fs.readFileSync(archive)).digest("hex") !==
    expected
) {
  const response = await fetch(base + archiveName);
  if (!response.ok) throw new Error("Cannot download bundled Node runtime");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw new Error("Node runtime checksum mismatch");
  fs.writeFileSync(archive, bytes);
}
const unpack = path.join(cache, "unpack");
fs.mkdirSync(unpack, { recursive: true });
execFileSync("tar", ["-xf", archive, "-C", unpack]);
const nodeRoot = path.join(
  unpack,
  `node-v${version}-${nodePlatform}-${process.arch}`,
);
const triple = execFileSync("rustc", ["-vV"], { encoding: "utf8" })
  .split("\n")
  .find((line) => line.startsWith("host: "))
  .slice(6)
  .trim();
const binaries = path.join(desktop, "src-tauri/binaries");
fs.mkdirSync(binaries, { recursive: true });
const binary = path.join(
  binaries,
  `sage-runtime-${triple}${process.platform === "win32" ? ".exe" : ""}`,
);
fs.copyFileSync(
  path.join(nodeRoot, process.platform === "win32" ? "node.exe" : "bin/node"),
  binary,
);
fs.chmodSync(binary, 0o755);
fs.copyFileSync(
  path.join(nodeRoot, "LICENSE"),
  path.join(assets, "Node-LICENSE"),
);
console.log(
  `Verified bundled Node ${version}; Tauri sidecar ${path.basename(binary)}`,
);

const noticed = new Set(),
  notices = [];
for (const input of inputFiles) {
  if (!input.includes("node_modules")) continue;
  let directory = path.dirname(input);
  while (
    !fs.existsSync(path.join(directory, "package.json")) &&
    directory !== path.dirname(directory)
  )
    directory = path.dirname(directory);
  if (noticed.has(directory)) continue;
  noticed.add(directory);
  const metadata = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  for (const file of fs
    .readdirSync(directory)
    .filter((file) => /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(file))) {
    if (fs.statSync(path.join(directory, file)).isFile())
      notices.push(
        `\n--- ${metadata.name} ${metadata.version}: ${file} ---\n` +
          fs.readFileSync(path.join(directory, file), "utf8"),
      );
  }
}
fs.writeFileSync(
  path.join(assets, "THIRD-PARTY-NOTICES.txt"),
  notices.join("\n"),
);
fs.copyFileSync(
  path.join(repo, "packages/simplenlg-core/LICENSE"),
  path.join(assets, "SimpleNLG-LICENSE"),
);

fs.copyFileSync(
  path.join(repo, "packages/sage-core/src/aoe2/reference/halfon-LICENSE"),
  path.join(assets, "Halfon-LICENSE"),
);
fs.copyFileSync(
  path.join(repo, "packages/sage-core/src/aoe2/reference/source.json"),
  path.join(assets, "unit-reference-source.json"),
);
fs.copyFileSync(path.join(repo, "LICENSE"), path.join(assets, "SAGE-LICENSE"));
