import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

// macOS can retain this fixed two-byte system flag after xattr -c. It has no
// identity, source URL or machine identifier. Reject every other attribute.
export function metadataIsNonidentifying(output) {
  return output
    .split("\n")
    .every(
      (line) =>
        !line.trim() ||
        /^[^:\r\n]+: com\.apple\.provenance: \x01\x02$/.test(line),
    );
}

/** Builder values are compared in memory and never included in diagnostics. */
export function privateValues(environment = process.env) {
  const values = Object.entries(environment)
    .filter(
      ([key, value]) =>
        /TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY/i.test(key) &&
        value?.length >= 12,
    )
    .map(([, value]) => value);
  const home = environment.SAGE_HOME;
  if (home) {
    try {
      const visit = (value) => {
        if (!value || typeof value !== "object") return;
        for (const [key, item] of Object.entries(value)) {
          if (
            /^(apiKey|hfToken|token|password|secret)$/i.test(key) &&
            typeof item === "string" &&
            item.length >= 8
          )
            values.push(item);
          else if (typeof item === "object") visit(item);
        }
      };
      visit(
        JSON.parse(fs.readFileSync(path.join(home, "settings.json"), "utf8")),
      );
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          "Could not read SAGE settings for the private-value check",
        );
    }
  }
  return [...new Set(values)];
}

export function auditDirectory(directory, { paths = [], secrets = [] } = {}) {
  const matches = [];
  const variants = (value) => [
    ...new Set([
      value,
      value.replaceAll("\\", "/"),
      value.replaceAll("/", "\\"),
      value.replaceAll("\\", "\\\\"),
    ]),
  ];
  const needles = [
    ...paths.filter(Boolean).flatMap((value) =>
      variants(value).map((text) => ({
        kind: "builder-or-private-path",
        text,
      })),
    ),
    ...secrets.filter(Boolean).map((text) => ({ kind: "private-value", text })),
  ].flatMap(({ kind, text }) =>
    ["utf8", "utf16le"].map((encoding) => ({
      kind,
      bytes: Buffer.from(text, encoding),
      folded:
        kind === "builder-or-private-path" &&
        /^(?:[A-Za-z]:[\\/]|\\\\|\/\/)/.test(text),
    })),
  );
  // Windows drive/path casing can change between the compiler and filesystem.
  // Fold ASCII bytes in both UTF-8 and UTF-16; credential matching stays exact.
  const fold = (bytes) =>
    bytes.map((byte) => (byte >= 65 && byte <= 90 ? byte + 32 : byte));
  for (const needle of needles)
    if (needle.folded) needle.bytes = fold(needle.bytes);
  const foldPaths = needles.some((needle) => needle.folded);
  const overlap = Math.max(
    256,
    ...needles.map((needle) => needle.bytes.length),
  );
  let files = 0,
    bytes = 0;
  const manifest = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      const relative = path.relative(directory, file).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(file);
        if (!target.startsWith(fs.realpathSync(directory) + path.sep))
          matches.push({ file: relative, kind: "external-symlink" });
        continue;
      }
      if (
        /^(\.env(?:\..*)?|\.git|\.DS_Store|settings\.json|sessions\.json|run\.json|launcher\.log)$/i.test(
          entry.name,
        ) ||
        /\.(?:pem|p12|pfx|key|log|pdb|map)$/i.test(entry.name)
      )
        matches.push({ file: relative, kind: "private-or-debug-file" });
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!entry.isFile()) continue;
      files++;
      const found = new Set();
      const hash = createHash("sha256");
      const fd = fs.openSync(file, "r");
      const buffer = Buffer.alloc(1024 * 1024);
      let previous = Buffer.alloc(0),
        read;
      try {
        while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
          const chunk = buffer.subarray(0, read);
          bytes += read;
          hash.update(chunk);
          const joined = Buffer.concat([previous, chunk]);
          const folded = foldPaths ? fold(joined) : undefined;
          for (const needle of needles)
            if ((needle.folded ? folded : joined).includes(needle.bytes))
              found.add(needle.kind);
          previous = Buffer.from(
            joined.subarray(Math.max(0, joined.length - overlap)),
          );
        }
      } finally {
        fs.closeSync(fd);
      }
      for (const kind of found) matches.push({ file: relative, kind });
      manifest.push({ file: relative, sha256: hash.digest("hex") });
    }
  };
  walk(directory);
  return {
    passed: matches.length === 0,
    files,
    bytes,
    matches,
    manifest: manifest.sort((a, b) => a.file.localeCompare(b.file)),
  };
}

export function buildEnvironment(
  source,
  {
    environment = process.env,
    repo,
    scratch,
    target,
    platform = process.platform,
  } = {},
) {
  const result = {};
  for (const key of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "LANG",
    "LC_ALL",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "SDKROOT",
    "DEVELOPER_DIR",
  ])
    if (environment[key]) result[key] = environment[key];
  if (platform === "win32") {
    for (const key of [
      "PATHEXT",
      "ProgramFiles",
      "ProgramFiles(x86)",
      "ProgramW6432",
      "ProgramData",
      "SYSTEMDRIVE",
      "INCLUDE",
      "LIB",
      "LIBPATH",
      "WindowsSdkDir",
      "WindowsSDKVersion",
      "VCToolsInstallDir",
      "VSINSTALLDIR",
      "VCINSTALLDIR",
      "VSCMD_ARG_TGT_ARCH",
      "VSCMD_ARG_HOST_ARCH",
      "VSCMD_VER",
      "UCRTVersion",
      "UniversalCRTSdkDir",
    ]) {
      if (environment[key]) result[key] = environment[key];
    }
  }
  Object.assign(result, {
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    DO_NOT_TRACK: "1",
    COPYFILE_DISABLE: "1",
    npm_config_registry: "https://registry.npmjs.org",
    npm_config_userconfig: path.join(scratch, "empty.npmrc"),
    npm_config_globalconfig: path.join(scratch, "empty-global.npmrc"),
    CARGO_TARGET_DIR: target,
    CARGO_ENCODED_RUSTFLAGS: [
      ...[os.homedir(), fs.realpathSync(os.homedir())].map(
        (prefix) => `--remap-path-prefix=${prefix}=/build/home`,
      ),
      `--remap-path-prefix=${os.tmpdir()}=/build/tmp`,
      `--remap-path-prefix=${scratch}=/build/tmp`,
      `--remap-path-prefix=${repo}=/build/sage`,
      `--remap-path-prefix=${source}=/build/sage`,
      ...(platform === "win32"
        ? ["-C", "link-arg=/PDBALTPATH:sage-desktop.pdb"]
        : []),
    ].join("\x1f"),
  });
  return result;
}
