import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  hashFile,
  hashNsisApplication,
  verifyWindowsPayload,
} from "./windows-payload.mjs";

test("NSIS payload must match application, sidecar and every resource", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "sage-windows-payload-"),
  );
  try {
    const root = path.join(directory, "$INSTDIR");
    fs.mkdirSync(path.join(root, "runtime/assets"), { recursive: true });
    const app = path.join(root, "SAGE.exe"),
      sidecar = path.join(root, "sage-runtime.exe"),
      resource = path.join(root, "runtime/assets/version.txt");
    fs.writeFileSync(app, "expected application __TAURI_BUNDLE_TYPE_VAR_NSS");
    const buildApp = path.join(directory, "build-app.exe");
    fs.writeFileSync(
      buildApp,
      "expected application __TAURI_BUNDLE_TYPE_VAR_UNK",
    );
    fs.writeFileSync(sidecar, "expected runtime");
    fs.writeFileSync(resource, "expected source revision");
    const manifest = [
      {
        file: "sage-desktop.exe",
        sha256: hashNsisApplication(buildApp),
        application: true,
      },
      { file: "sage-runtime.exe", sha256: hashFile(sidecar) },
      { file: "runtime/assets/version.txt", sha256: hashFile(resource) },
    ];
    assert.equal(verifyWindowsPayload(directory, manifest).filesVerified, 3);
    fs.writeFileSync(app, "tampered application __TAURI_BUNDLE_TYPE_VAR_NSS");
    assert.throws(
      () => verifyWindowsPayload(directory, manifest),
      /exactly one/,
    );
    fs.writeFileSync(app, "expected application __TAURI_BUNDLE_TYPE_VAR_NSS");
    fs.writeFileSync(sidecar, "substituted runtime");
    assert.throws(
      () => verifyWindowsPayload(directory, manifest),
      /payload mismatch: sage-runtime.exe/,
    );
    fs.writeFileSync(sidecar, "expected runtime");
    fs.rmSync(resource);
    assert.throws(
      () => verifyWindowsPayload(directory, manifest),
      /payload mismatch: runtime\/assets\/version.txt/,
    );
    fs.copyFileSync(app, path.join(directory, "duplicate.exe"));
    assert.throws(
      () => verifyWindowsPayload(directory, manifest),
      /exactly one/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
