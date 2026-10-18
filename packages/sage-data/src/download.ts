import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";

export interface DownloadOptions {
  accessToken?: string | undefined;
  signal?: AbortSignal | undefined;
  onBytes?: ((received: number, total?: number) => void) | undefined;
}

/** Stream a versioned resource to disk; a partial is never treated as complete. */
async function performDownload(
  url: string,
  destination: string,
  options: DownloadOptions = {},
): Promise<string | undefined> {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const partial = destination + ".partial";
  const metadataPath = partial + ".json";
  let metadata: { url?: string; etag?: string; total?: number } = {};
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch {
    /* first attempt */
  }
  let offset =
    fs.existsSync(partial) && metadata.url === url && metadata.etag
      ? fs.statSync(partial).size
      : 0;
  const headers: Record<string, string> = {};
  if (options.accessToken)
    headers["Authorization"] = `Bearer ${options.accessToken}`;
  if (offset) {
    headers["Range"] = `bytes=${offset}-`;
    headers["If-Range"] = metadata.etag!;
  }
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    options.signal?.throwIfAborted();
    response = await fetch(url, { headers, signal: options.signal ?? null });
    if (![429, 502, 503, 504].includes(response.status) || attempt === 3) break;
    const retry = response.headers.get("retry-after");
    const seconds = retry
      ? Number(retry) || Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
      : 2 ** attempt;
    await response.body?.cancel();
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("Download cancelled"));
      };
      const timer = setTimeout(
        () => {
          options.signal?.removeEventListener("abort", abort);
          resolve();
        },
        Math.min(seconds, 30) * 1000,
      );
      options.signal?.addEventListener("abort", abort, { once: true });
    });
  }
  if (response!.status === 404) {
    await response!.body?.cancel();
    return undefined;
  }
  if (!response!.ok) {
    await response!.body?.cancel();
    throw new Error(
      `Dataset download failed (${response!.status}); check access or retry later`,
    );
  }
  const etag = response!.headers.get("etag") ?? undefined;
  let total: number | undefined;
  if (response!.status === 206) {
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
      response!.headers.get("content-range") ?? "",
    );
    if (
      !offset ||
      !range ||
      Number(range[1]) !== offset ||
      (etag && metadata.etag !== etag)
    ) {
      await response!.body?.cancel();
      throw new Error(
        "Invalid resume response; cached partial was not published",
      );
    }
    total = Number(range[3]);
  } else {
    offset = 0;
    const length = response!.headers.get("content-length");
    if (length !== null) total = Number(length);
  }
  if (!response!.body) throw new Error("Download returned no body");
  fs.writeFileSync(metadataPath, JSON.stringify({ url, etag, total }), {
    mode: 0o600,
  });
  const hash = createHash("sha256");
  if (offset)
    for await (const chunk of fs.createReadStream(partial)) hash.update(chunk);
  let received = offset;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, next) {
      received += chunk.length;
      hash.update(chunk);
      options.onBytes?.(received, total);
      next(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response!.body as never),
    counter,
    fs.createWriteStream(partial, { flags: offset ? "a" : "w", mode: 0o600 }),
    { signal: options.signal },
  );
  if (total !== undefined && received !== total)
    throw new Error(
      `Incomplete download: received ${received} of ${total} bytes`,
    );
  const complete = { url, etag, bytes: received, sha256: hash.digest("hex") };
  fs.writeFileSync(destination + ".json.partial", JSON.stringify(complete), {
    mode: 0o600,
  });
  fs.renameSync(partial, destination);
  fs.renameSync(destination + ".json.partial", destination + ".json");
  fs.rmSync(metadataPath, { force: true });
  return destination;
}

export function isCompleteDownload(file: string, url: string): boolean {
  try {
    const metadata = JSON.parse(fs.readFileSync(file + ".json", "utf8"));
    return metadata.url === url && metadata.bytes === fs.statSync(file).size;
  } catch {
    return false;
  }
}

export async function downloadToFile(
  url: string,
  destination: string,
  options: DownloadOptions = {},
): Promise<string | undefined> {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const lock = destination + ".lock";
  let fd: number;
  try {
    fd = fs.openSync(lock, "wx", 0o600);
  } catch {
    let stale = false;
    try {
      const pid = Number(fs.readFileSync(lock, "utf8"));
      if (pid > 0) {
        try {
          process.kill(pid, 0);
        } catch (error) {
          stale = (error as NodeJS.ErrnoException).code === "ESRCH";
        }
      }
    } catch {
      /* active creator may still be writing */
    }
    if (!stale)
      throw new Error("Download is already active; retry after it finishes");
    fs.rmSync(lock, { force: true });
    fd = fs.openSync(lock, "wx", 0o600);
  }
  fs.writeSync(fd, String(process.pid));
  try {
    return await performDownload(url, destination, options);
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}
