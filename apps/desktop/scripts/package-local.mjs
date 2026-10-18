import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  auditDirectory,
  buildEnvironment,
  privateValues,
  metadataIsNonidentifying,
} from "./privacy.mjs";

const desktop = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(desktop, "../..");
if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error(
    "The privacy-checked local packager currently supports macOS Apple Silicon. Other platforms retain their native CI build workflow.",
  );
}
const git = (...args) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
if (git("status", "--porcelain").length)
  throw new Error(
    "Commit source changes before packaging: the installer is built from git archive HEAD.",
  );
const commit = git("rev-parse", "HEAD");
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid source revision");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sage-local-release-"));
const source = path.join(scratch, "source");
const target = path.join(desktop, ".local-target");
const output = path.join(desktop, "release", commit.slice(0, 12));
const secrets = privateValues();
const privatePaths = [
  os.homedir(),
  fs.realpathSync(os.homedir()),
  repo,
  scratch,
  os.tmpdir(),
  process.env.SAGE_HOME,
  process.env.SAGE_DATA_DIR,
];
const env = {
  ...buildEnvironment(source, { repo, scratch, target }),
  SAGE_BUILD_COMMIT: commit,
};
const run = (command, args, cwd = source) => {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw new Error(`Local packaging step failed: ${path.basename(command)}`);
};
const pnpmEntry = process.env.npm_execpath;
const pnpm = (...args) =>
  pnpmEntry ? run(process.execPath, [pnpmEntry, ...args]) : run("pnpm", args);
const check = (directory) => {
  const audit = auditDirectory(directory, { paths: privatePaths, secrets });
  if (!audit.passed) {
    // Relative packaged paths and categories only; never print matched values.
    console.error(JSON.stringify({ matches: audit.matches }, null, 2));
    throw new Error("Privacy audit failed; no installer was approved");
  }
  return audit;
};
let mounted = false;
const mount = path.join(scratch, "mounted");
try {
  fs.mkdirSync(source);
  const archive = path.join(scratch, "source.tar");
  const fd = fs.openSync(archive, "w");
  try {
    execFileSync("git", ["archive", "--format=tar", "HEAD"], {
      cwd: repo,
      stdio: ["ignore", fd, "inherit"],
    });
  } finally {
    fs.closeSync(fd);
  }
  run("tar", ["-xf", archive, "-C", source]);
  fs.rmSync(archive);
  const removeEnvironmentFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (/^(\.env(?:\..*)?|\.npmrc)$/i.test(entry.name))
        fs.rmSync(file, { recursive: true, force: true });
      else if (entry.isDirectory()) removeEnvironmentFiles(file);
    }
  };
  removeEnvironmentFiles(source);
  fs.writeFileSync(env.npm_config_userconfig, "");
  fs.writeFileSync(env.npm_config_globalconfig, "");
  console.log(
    "Installing locked dependencies in a clean source export (no local environment files or credentials).",
  );
  pnpm(
    "install",
    "--frozen-lockfile",
    "--shamefully-hoist",
    "--strict-peer-dependencies=false",
  );
  pnpm("--filter", "@sage/desktop", "assemble");
  check(path.join(source, "apps/desktop/stage"));
  run(process.execPath, ["apps/desktop/scripts/smoke.mjs"]);
  const config = JSON.stringify({
    build: { beforeBuildCommand: null },
    bundle: { macOS: { signingIdentity: "-" } },
  });
  pnpm(
    "--filter",
    "@sage/desktop",
    "exec",
    "tauri",
    "build",
    "--ci",
    "--bundles",
    "app",
    "--config",
    config,
  );
  const app = path.join(target, "release/bundle/macos/SAGE.app");
  run("xattr", ["-cr", app]);
  run("codesign", ["--verify", "--deep", "--strict", app]);
  const audit = check(app);
  if (
    !metadataIsNonidentifying(
      execFileSync("xattr", ["-lr", app], { encoding: "utf8" }),
    )
  )
    throw new Error("Unexpected application extended attributes");
  const imageSource = path.join(scratch, "image");
  fs.mkdirSync(imageSource);
  fs.cpSync(app, path.join(imageSource, "SAGE.app"), { recursive: true });
  fs.symlinkSync("/Applications", path.join(imageSource, "Applications"));
  run("xattr", ["-cr", path.join(imageSource, "SAGE.app")]);
  const filename = "SAGE-macOS-Apple-Silicon-local.dmg";
  const candidate = path.join(scratch, filename);
  run("hdiutil", [
    "create",
    "-quiet",
    "-volname",
    "SAGE",
    "-srcfolder",
    imageSource,
    "-format",
    "UDZO",
    "-ov",
    "-o",
    candidate,
  ]);
  run("xattr", ["-c", candidate]);
  fs.mkdirSync(mount);
  run("hdiutil", [
    "attach",
    "-quiet",
    "-readonly",
    "-nobrowse",
    "-mountpoint",
    mount,
    candidate,
  ]);
  mounted = true;
  const mountedApp = path.join(mount, "SAGE.app");
  const delivered = check(mountedApp);
  if (JSON.stringify(delivered.manifest) !== JSON.stringify(audit.manifest))
    throw new Error("Installer contents differ from the audited application");
  if (
    !metadataIsNonidentifying(
      execFileSync("xattr", ["-lr", mountedApp], { encoding: "utf8" }),
    )
  )
    throw new Error("Unexpected installer application extended attributes");
  run("hdiutil", ["detach", "-quiet", mount]);
  mounted = false;
  const sha256 = createHash("sha256")
    .update(fs.readFileSync(candidate))
    .digest("hex");
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(candidate, path.join(output, filename));
  run("xattr", ["-c", path.join(output, filename)]);
  if (
    !metadataIsNonidentifying(
      execFileSync("xattr", ["-l", path.join(output, filename)], {
        encoding: "utf8",
      }).replace(/^com\./gm, "artifact: com."),
    )
  )
    throw new Error("Unexpected disk image extended attributes");
  fs.writeFileSync(
    path.join(output, "SHA256SUMS.txt"),
    `${sha256}  ${filename}\n`,
  );
  fs.writeFileSync(
    path.join(output, "privacy-report.json"),
    JSON.stringify(
      {
        sourceCommit: commit,
        platform: "darwin",
        architecture: "arm64",
        signing: "ad-hoc; not notarized",
        artifact: filename,
        sha256,
        passed: true,
        filesChecked: delivered.files,
        bytesChecked: delivered.bytes,
        checks: [
          "clean tracked source export",
          "environment and npm config allowlist",
          "no local environment files",
          "Rust compiler paths remapped",
          "known private paths and credential values absent (UTF-8 and UTF-16)",
          "private runtime/debug filenames absent",
          "identifying extended attributes absent; only fixed macOS provenance flags permitted",
          "application code signature verified",
          "mounted installer hashes match audited app",
          "bundled Node/DuckDB generation smoke test passed",
        ],
        retained: [
          "public license attributions",
          "four committed 60-second example matches",
        ],
        limitations:
          "Checks known builder paths, credential values and private file categories; this is not a guarantee against every possible form of personal data. No signing identity, notarization, release or tag is created.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Privacy checks passed. Installer and report: apps/desktop/release/${commit.slice(0, 12)}/`,
  );
} finally {
  const detached =
    !mounted || spawnSync("hdiutil", ["detach", "-quiet", mount]).status === 0;
  if (detached) fs.rmSync(scratch, { recursive: true, force: true });
  else
    console.error(
      "Could not detach the temporary installer volume; its temporary directory was retained.",
    );
}
