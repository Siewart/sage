import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { DownloadedDataset } from "@sage/contracts";
import type { SageLayout } from "@sage/data/hf/layout";

export interface CachedMatch extends DownloadedDataset {
  path: string;
}

async function directories(parent: string) {
  try {
    return (await fs.readdir(parent, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function storedBytes(
  directory: string,
): Promise<{ bytes: number; payload: boolean }> {
  let bytes = 0;
  let payload = false;
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    try {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        const child = await storedBytes(file);
        bytes += child.bytes;
        payload ||= child.payload;
      } else if (entry.isFile()) {
        bytes += (await fs.lstat(file)).size;
        payload ||=
          entry.name === "descriptor.json" ||
          /\.(?:parquet|arrow|zip)(?:\.[a-f0-9-]+)?(?:\.partial)?$/i.test(
            entry.name,
          );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // Download workers may rename partial files while the inventory is read.
    }
  }
  return { bytes, payload };
}

/** Only the known HF match hierarchy belongs to SAGE; never follow links into user files. */
export async function cachedMatches(
  dataDirectory: string,
  layout: SageLayout,
): Promise<CachedMatch[]> {
  let root: string;
  try {
    root = await fs.realpath(dataDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const repo = path.join(root, layout.repo);
  if (!(await canonicalDirectory(repo, root))) return [];
  const result: CachedMatch[] = [];
  for (const revision of await directories(repo)) {
    if (!/^[a-f0-9]{40}$/i.test(revision)) continue;
    for (const corpus of layout.facets["corpus"] ?? []) {
      const exports = path.join(repo, revision, corpus, "export");
      if (!(await canonicalDirectory(exports, root))) continue;
      for (const resolution of await directories(exports)) {
        if (!["1000", "60000"].includes(resolution)) continue;
        const parent = path.join(exports, resolution);
        for (const name of await directories(parent)) {
          const directory = path.join(parent, name);
          if (!(await canonicalDirectory(directory, root))) continue;
          const { bytes, payload } = await storedBytes(directory);
          if (!payload || !bytes) continue;
          result.push({
            id: createHash("sha256").update(directory).digest("hex"),
            name,
            corpus,
            resolution,
            revision,
            bytes,
            path: directory,
          });
        }
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function canonicalDirectory(directory: string, root: string) {
  try {
    const canonical = await fs.realpath(directory);
    return canonical === directory && canonical.startsWith(root + path.sep);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function containsPath(directory: string, file: string) {
  const relative = path.relative(directory, path.resolve(file));
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
