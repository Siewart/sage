import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export function hashFile(file) {
  const hash = createHash("sha256");
  const fd = fs.openSync(file, "r"),
    buffer = Buffer.alloc(1024 * 1024);
  try {
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0)
      hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function walk(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

export function windowsPayloadManifest({ executable, sidecar, runtime }) {
  const manifest = [
    {
      file: "sage-desktop.exe",
      sha256: hashFile(executable),
      application: true,
    },
    { file: "sage-runtime.exe", sha256: hashFile(sidecar) },
  ];
  for (const name of [
    "service.mjs",
    "worker.mjs",
    "bootstrap.mjs",
    "duckdb-worker.mjs",
    "assets",
    "node_modules",
  ]) {
    const source = path.join(runtime, name);
    const files = fs.statSync(source).isDirectory() ? walk(source) : [source];
    for (const file of files)
      manifest.push({
        file:
          "runtime/" + path.relative(runtime, file).split(path.sep).join("/"),
        sha256: hashFile(file),
      });
  }
  return manifest;
}

/** Verify installed files, independent of the NSIS extraction root's name. */
export function verifyWindowsPayload(directory, manifest) {
  const application = manifest.find((entry) => entry.application);
  if (!application) throw new Error("Application digest is missing");
  const matches = walk(directory).filter(
    (file) => /\.exe$/i.test(file) && hashFile(file) === application.sha256,
  );
  if (matches.length !== 1)
    throw new Error(
      "Extracted installer must contain exactly one matching application executable",
    );
  const root = path.dirname(matches[0]);
  for (const entry of manifest) {
    if (entry.application) continue;
    const file = path.resolve(root, entry.file);
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile() ||
      hashFile(file) !== entry.sha256
    ) {
      throw new Error(`Extracted installer payload mismatch: ${entry.file}`);
    }
  }
  return { root, filesVerified: manifest.length };
}
