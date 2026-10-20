import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  auditDirectory,
  buildEnvironment,
  privateValues,
  metadataIsNonidentifying,
} from "./privacy.mjs";

test("metadata check allows only the fixed macOS provenance flag", () => {
  assert.ok(metadataIsNonidentifying(""));
  assert.ok(
    metadataIsNonidentifying("app/file: com.apple.provenance: \x01\x02\n"),
  );
  assert.ok(
    !metadataIsNonidentifying(
      "app/file: com.apple.provenance: personal-value\n",
    ),
  );
  assert.ok(
    !metadataIsNonidentifying(
      "app/file: com.apple.metadata:kMDItemWhereFroms: source-url\n",
    ),
  );
  assert.ok(
    !metadataIsNonidentifying("app/file: com.apple.quarantine: value\n"),
  );
});

test("artifact audit detects binary paths, UTF-16 secrets and private files without echoing values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sage-privacy-"));
  const privatePath = "/Users/private-builder/project";
  const secret = "test-only-secret-please-never-print";
  try {
    // Put a path across the streaming scanner's one-MiB read boundary.
    fs.writeFileSync(
      path.join(root, "binary"),
      Buffer.concat([
        Buffer.alloc(1024 * 1024 - 4),
        Buffer.from(privatePath),
        Buffer.from(secret, "utf16le"),
      ]),
    );
    fs.writeFileSync(path.join(root, ".env.local"), "not shipped");
    const result = auditDirectory(root, {
      paths: [privatePath],
      secrets: [secret],
    });
    assert.equal(result.passed, false);
    assert.deepEqual(
      new Set(result.matches.map((match) => match.kind)),
      new Set([
        "builder-or-private-path",
        "private-value",
        "private-or-debug-file",
      ]),
    );
    assert.ok(!JSON.stringify(result).includes(privatePath));
    assert.ok(!JSON.stringify(result).includes(secret));
    fs.rmSync(path.join(root, "binary"));
    fs.rmSync(path.join(root, ".env.local"));
    fs.writeFileSync(
      path.join(root, "LICENSE"),
      "Copyright Public Author <public@example.org>",
    );
    assert.equal(
      auditDirectory(root, { paths: [privatePath], secrets: [secret] }).passed,
      true,
      "public license attributions are retained",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("build environment excludes credentials, profiles, signing identities and public-env injection", () => {
  const environment = {
    PATH: "/usr/bin",
    HOME: os.homedir(),
    HF_TOKEN: "test-hf-token-abcdefghijkl",
    NEXT_PUBLIC_PRIVATE_VALUE: "do-not-bundle-this",
    SAGE_HOME: "/private/profile",
    APPLE_SIGNING_IDENTITY: "Personal Certificate",
    NODE_OPTIONS: "--inspect",
  };
  const result = buildEnvironment("/tmp/source", {
    environment,
    repo: "/tmp/repo",
    scratch: "/tmp/scratch",
    target: "/tmp/target",
  });
  assert.equal(result.HOME, environment.HOME);
  for (const key of [
    "HF_TOKEN",
    "NEXT_PUBLIC_PRIVATE_VALUE",
    "SAGE_HOME",
    "APPLE_SIGNING_IDENTITY",
    "NODE_OPTIONS",
  ])
    assert.ok(!(key in result));
  assert.ok(
    result.CARGO_ENCODED_RUSTFLAGS.includes(
      "--remap-path-prefix=/tmp/source=/build/sage",
    ),
  );
  assert.equal(result.NEXT_TELEMETRY_DISABLED, "1");
  assert.deepEqual(privateValues({ HF_TOKEN: environment.HF_TOKEN }), [
    environment.HF_TOKEN,
  ]);
});

test("Windows path scans handle slash and ASCII case differences in binary encodings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sage-windows-paths-"));
  try {
    fs.writeFileSync(
      path.join(root, "binary.exe"),
      Buffer.concat([
        Buffer.from("c:/users/private-builder/project"),
        Buffer.from("C:\\USERS\\PRIVATE-BUILDER\\PROJECT", "utf16le"),
        Buffer.from("token-only-lowercase"),
      ]),
    );
    const result = auditDirectory(root, {
      paths: ["C:\\Users\\Private-Builder\\Project"],
      secrets: ["TOKEN-ONLY-LOWERCASE"],
    });
    assert.deepEqual(
      result.matches.map((match) => match.kind),
      ["builder-or-private-path"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Windows compiler environment retains SDK paths but excludes injected compiler/signing options", () => {
  const result = buildEnvironment("/tmp/source", {
    repo: "/tmp/repo",
    scratch: "/tmp/scratch",
    target: "/tmp/target",
    platform: "win32",
    environment: {
      HOME: os.homedir(),
      PATH: "/usr/bin",
      INCLUDE: "C:\\SDK\\include",
      LIB: "C:\\SDK\\lib",
      _CL_: "/path/injected",
      TAURI_SIGNING_PRIVATE_KEY: "test-only-signing-secret",
      WINDOWS_CERTIFICATE_PASSWORD: "test-only-password",
    },
  });
  assert.equal(result.INCLUDE, "C:\\SDK\\include");
  assert.equal(result.LIB, "C:\\SDK\\lib");
  assert.ok(
    result.CARGO_ENCODED_RUSTFLAGS.includes(
      "link-arg=/PDBALTPATH:sage-desktop.pdb",
    ),
  );
  for (const key of [
    "_CL_",
    "TAURI_SIGNING_PRIVATE_KEY",
    "WINDOWS_CERTIFICATE_PASSWORD",
  ])
    assert.ok(!(key in result));
});
