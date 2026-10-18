import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import { Transform } from "node:stream";
import { crc32 } from "node:zlib";

/** Extract with bounded buffers, validated paths and an atomic completion marker. */
export async function extractZip(
  archive: string,
  directory: string,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const marker = path.join(directory, ".complete.json");
  const stamp = `${fs.statSync(archive).size}:${fs.statSync(archive).mtimeMs}`;
  try {
    const saved = JSON.parse(fs.readFileSync(marker, "utf8"));
    if (
      saved.stamp === stamp &&
      Object.values(saved.files).every(
        (p) => typeof p === "string" && fs.existsSync(p),
      )
    )
      return saved.files;
  } catch {
    /* incomplete or first extraction */
  }
  const temporary = directory + "." + randomUUID() + ".partial";
  fs.mkdirSync(temporary, { recursive: true });
  const files: Record<string, string> = {};
  try {
    await new Promise<void>((resolve, reject) => {
      yauzl.open(
        archive,
        { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
        (error, zip) => {
          if (error || !zip) {
            reject(error ?? new Error("Cannot open archive"));
            return;
          }
          const abort = () => {
            zip.close();
            reject(new Error("Extraction cancelled"));
          };
          signal?.addEventListener("abort", abort, { once: true });
          zip.on("error", reject);
          zip.on("end", () => {
            signal?.removeEventListener("abort", abort);
            resolve();
          });
          let total = 0;
          zip.on("entry", (entry: yauzl.Entry) => {
            void (async () => {
              signal?.throwIfAborted();
              const name = entry.fileName;
              const parts = name.split("/");
              const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
              if (
                parts.some((p) => p === "..") ||
                path.isAbsolute(name) ||
                /^[A-Za-z]:/.test(name) ||
                name.includes("\\") ||
                mode === 0xa000
              )
                throw new Error("Unsafe archive entry");
              total += entry.uncompressedSize;
              if (
                total > 100 * 1024 ** 3 ||
                entry.uncompressedSize > 32 * 1024 ** 3
              )
                throw new Error("Archive exceeds extraction limit");
              const target = path.join(temporary, ...parts);
              if (name.endsWith("/")) {
                fs.mkdirSync(target, { recursive: true });
                zip.readEntry();
                return;
              }
              const key = path.basename(name);
              if (files[key]) throw new Error("Duplicate archive filename");
              fs.mkdirSync(path.dirname(target), { recursive: true });
              const input = await new Promise<NodeJS.ReadableStream>(
                (ok, fail) =>
                  zip.openReadStream(entry, (err, stream) =>
                    err || !stream ? fail(err) : ok(stream),
                  ),
              );
              let checksum = 0;
              const verify = new Transform({
                transform(chunk: Buffer, _encoding, next) {
                  checksum = crc32(chunk, checksum);
                  next(null, chunk);
                },
              });
              await pipeline(
                input,
                verify,
                fs.createWriteStream(target, { flags: "wx" }),
                { signal },
              );
              if (checksum !== entry.crc32)
                throw new Error("Archive CRC mismatch");
              files[key] = path.join(directory, ...parts);
              zip.readEntry();
            })().catch((error) => {
              zip.close();
              reject(error);
            });
          });
          zip.readEntry();
        },
      );
    });
    fs.writeFileSync(
      path.join(temporary, ".complete.json"),
      JSON.stringify({ stamp, files }),
    );
    fs.rmSync(directory, { recursive: true, force: true });
    fs.renameSync(temporary, directory);
    return files;
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}
