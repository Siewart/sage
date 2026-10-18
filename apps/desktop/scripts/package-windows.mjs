import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { auditDirectory, buildEnvironment, privateValues } from "./privacy.mjs";
import {
  hashFile,
  windowsPayloadManifest,
  verifyWindowsPayload,
} from "./windows-payload.mjs";

if (process.platform !== "win32" || process.arch !== "x64")
  throw new Error("The Windows preview packager requires native Windows x64");
const desktop = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(desktop, "../..");
const git = (...args) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
if (git("status", "--porcelain"))
  throw new Error(
    "Commit source changes before packaging: the installer is built from git archive HEAD",
  );
const commit = git("rev-parse", "HEAD");
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid source revision");
if (!process.env.npm_execpath)
  throw new Error(
    "Run pnpm desktop:package so the locked pnpm CLI is available",
  );
const triple = execFileSync("rustc", ["-vV"], { encoding: "utf8" })
  .match(/^host: (.+)$/m)?.[1]
  ?.trim();
if (triple !== "x86_64-pc-windows-msvc")
  throw new Error(
    "The Windows build requires the x86_64-pc-windows-msvc Rust toolchain",
  );
const sevenZip = [
  ...[process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
    .filter(Boolean)
    .map((root) => path.join(root, "7-Zip/7z.exe")),
  ...(spawnSync("where.exe", ["7z.exe"], { encoding: "utf8" }).stdout ?? "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean),
].find((file) => fs.existsSync(file));
if (!sevenZip)
  throw new Error(
    "7-Zip is required to extract and audit the finished NSIS installer",
  );
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sage-local-release-"));
const source = path.join(scratch, "source"),
  target = path.join(desktop, ".local-target"),
  output = path.join(desktop, "release", commit.slice(0, 12));
const secrets = privateValues();
const paths = [
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
const run = (command, args, extra = {}) => {
  const result = spawnSync(command, args, {
    cwd: source,
    env,
    stdio: "inherit",
    ...extra,
  });
  if (result.error || result.status !== 0)
    throw new Error(`Windows packaging step failed: ${path.basename(command)}`);
};
const pnpm = (...args) =>
  run(process.execPath, [process.env.npm_execpath, ...args]);
const check = (directory) => {
  const result = auditDirectory(directory, { paths, secrets });
  if (!result.passed) {
    console.error(JSON.stringify({ matches: result.matches }, null, 2));
    throw new Error("Privacy audit failed; no installer was approved");
  }
  return result;
};
const powershell = (script) =>
  execFileSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(
        "$ErrorActionPreference='Stop';" + script,
        "utf16le",
      ).toString("base64"),
    ],
    { cwd: source, env, encoding: "utf8" },
  ).trim();
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const checkStreams = (directory) => {
  const count = powershell(
    `$p=Get-Item -LiteralPath ${literal(directory)}; $files=if($p.PSIsContainer){Get-ChildItem -LiteralPath $p.FullName -File -Recurse -Force}else{@($p)}; $count=0; foreach($f in $files){$count+=@(Get-Item -LiteralPath $f.FullName -Stream '*' | Where-Object {$_.Stream -ne ':$DATA'}).Count}; $count`,
  );
  if (count !== "0")
    throw new Error(
      "Unexpected NTFS alternate data streams in artifact contents",
    );
};
try {
  fs.mkdirSync(source);
  const archive = path.join(scratch, "source.tar"),
    fd = fs.openSync(archive, "w");
  try {
    execFileSync("git", ["archive", "--format=tar", "HEAD"], {
      cwd: repo,
      stdio: ["ignore", fd, "inherit"],
    });
  } finally {
    fs.closeSync(fd);
  }
  run("tar.exe", ["-xf", archive, "-C", source]);
  fs.rmSync(archive);
  const removeEnvironmentFiles = (root) => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const file = path.join(root, entry.name);
      if (/^(\.env(?:\..*)?|\.npmrc)$/i.test(entry.name))
        fs.rmSync(file, { recursive: true, force: true });
      else if (entry.isDirectory()) removeEnvironmentFiles(file);
    }
  };
  removeEnvironmentFiles(source);
  fs.writeFileSync(env.npm_config_userconfig, "");
  fs.writeFileSync(env.npm_config_globalconfig, "");
  pnpm(
    "install",
    "--frozen-lockfile",
    "--shamefully-hoist",
    "--strict-peer-dependencies=false",
  );
  pnpm("--filter", "@sage/desktop", "assemble");
  const assembled = path.join(source, "apps/desktop/stage");
  check(assembled);
  run(process.execPath, ["apps/desktop/scripts/smoke.mjs"]);
  const nsisOutput = path.join(target, "release/bundle/nsis");
  // Only generated installer output is cleared; the user's app and profile are outside this directory.
  fs.rmSync(nsisOutput, { recursive: true, force: true });
  pnpm(
    "--filter",
    "@sage/desktop",
    "exec",
    "tauri",
    "build",
    "--ci",
    "--bundles",
    "nsis",
    "--config",
    JSON.stringify({
      build: { beforeBuildCommand: null },
      bundle: { windows: { certificateThumbprint: null, signCommand: null } },
    }),
  );
  const installers = fs
    .readdirSync(nsisOutput)
    .filter((file) => file.endsWith(".exe"));
  if (installers.length !== 1)
    throw new Error("Expected exactly one freshly built NSIS installer");
  const candidateFolder = path.join(scratch, "candidate");
  fs.mkdirSync(candidateFolder);
  const filename = "SAGE-Windows-x64-preview-setup.exe",
    candidate = path.join(candidateFolder, filename);
  fs.copyFileSync(path.join(nsisOutput, installers[0]), candidate);
  check(candidateFolder);
  checkStreams(candidateFolder);
  const extracted = path.join(scratch, "extracted");
  run(sevenZip, ["x", "-y", `-o${extracted}`, candidate]);
  const audit = check(extracted);
  checkStreams(extracted);
  const executable = path.join(target, "release/sage-desktop.exe");
  const statuses = JSON.parse(
    powershell(
      `@(${literal(executable)},${literal(candidate)}) | ForEach-Object {(Get-AuthenticodeSignature -LiteralPath $_).Status.ToString()} | ConvertTo-Json -Compress`,
    ),
  );
  if (
    !Array.isArray(statuses) ||
    statuses.length !== 2 ||
    statuses.some((value) => value !== "NotSigned")
  )
    throw new Error(
      "Windows preview must not contain a personal signing identity",
    );
  const runtime = path.join(assembled, "runtime");
  const manifest = windowsPayloadManifest({
    executable,
    sidecar: path.join(
      source,
      `apps/desktop/src-tauri/binaries/sage-runtime-${triple}.exe`,
    ),
    runtime,
  });
  const payload = verifyWindowsPayload(extracted, manifest);
  run(process.execPath, [
    "apps/desktop/scripts/smoke.mjs",
    "--runtime",
    path.join(payload.root, "runtime"),
    "--node",
    path.join(payload.root, "sage-runtime.exe"),
    "--frontend",
    path.join(runtime, "web"),
  ]);
  const sha256 = hashFile(candidate);
  fs.mkdirSync(output, { recursive: true });
  const artifact = path.join(output, filename);
  fs.copyFileSync(candidate, artifact);
  checkStreams(artifact);
  if (hashFile(artifact) !== sha256)
    throw new Error("Copied installer digest mismatch");
  fs.writeFileSync(
    path.join(output, "SHA256SUMS.txt"),
    `${sha256}  ${filename}\n`,
  );
  fs.writeFileSync(
    path.join(output, "privacy-report.json"),
    JSON.stringify(
      {
        sourceCommit: commit,
        platform: "win32",
        architecture: "x64",
        signing: "unsigned preview",
        artifact: filename,
        sha256,
        passed: true,
        filesChecked: audit.files,
        bytesChecked: audit.bytes,
        payloadFilesVerified: payload.filesVerified,
        checks: [
          "clean committed-source export",
          "filtered environment and npm configuration",
          "Rust paths remapped and MSVC PDB location generic",
          "assembled runtime, installer and extracted contents scanned for known private paths and credential values",
          "private/debug files excluded",
          "NTFS alternate data streams absent",
          "application and installer have no signing identity",
          "extracted runtime files match build inputs",
          "assembled and extracted Node/DuckDB generation smoke tests passed",
        ],
        retained: [
          "public license attributions",
          "four committed 60-second example matches",
          "upstream vendor signatures",
        ],
        limitations:
          "Checks known private paths, credential values and file categories, not every possible form of personal data. No release, upload or tag is created.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Privacy checks passed. Installer and local report: apps/desktop/release/${commit.slice(0, 12)}/`,
  );
} finally {
  fs.rmSync(scratch, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 500,
  });
}
