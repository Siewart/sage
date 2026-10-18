import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { downloadToFile, isCompleteDownload } from "../src/download.js";

test("an interrupted streamed download resumes with Range and preserves bytes", async () => {
  const body = Buffer.alloc(256 * 1024, 97);
  const ranges: string[] = [];
  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) ranges.push(range);
    const offset = range ? Number(range.match(/\d+/)![0]) : 0;
    res.writeHead(range ? 206 : 200, {
      ETag: '"version1"',
      "Content-Length": body.length - offset,
      ...(range
        ? {
            "Content-Range": `bytes ${offset}-${body.length - 1}/${body.length}`,
          }
        : {}),
    });
    let at = offset;
    const timer = setInterval(() => {
      if (at >= body.length) {
        clearInterval(timer);
        res.end();
      } else {
        res.write(body.subarray(at, at + 8192));
        at += 8192;
      }
    }, 2);
    res.on("close", () => clearInterval(timer));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sage-download-"));
  const target = path.join(dir, "match.zip");
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/match`;
  try {
    const controller = new AbortController();
    await assert.rejects(
      downloadToFile(url, target, {
        signal: controller.signal,
        onBytes: (bytes) => {
          if (bytes >= 32768) controller.abort();
        },
      }),
    );
    assert.equal(fs.existsSync(target), false);
    assert.ok(fs.statSync(target + ".partial").size > 0);
    await downloadToFile(url, target);
    assert.ok(ranges.length > 0);
    assert.deepEqual(fs.readFileSync(target), body);
    assert.ok(isCompleteDownload(target, url));
    assert.equal(fs.existsSync(target + ".lock"), false);
  } finally {
    server.close();
    server.closeAllConnections();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a server ignoring Range restarts rather than appending stale bytes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sage-restart-"));
  const target = path.join(dir, "file");
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { ETag: '"new"', "Content-Length": 3 });
    res.end("new");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/file`;
  fs.writeFileSync(target + ".partial", "old");
  fs.writeFileSync(
    target + ".partial.json",
    JSON.stringify({ url, etag: '"old"' }),
  );
  try {
    await downloadToFile(url, target);
    assert.equal(fs.readFileSync(target, "utf8"), "new");
  } finally {
    server.close();
    server.closeAllConnections();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("404 is optional and authentication is supplied only as a header", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sage-auth-"));
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer example-token");
    assert.ok(!req.url!.includes("example-token"));
    res.writeHead(404);
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    assert.equal(
      await downloadToFile(
        `http://127.0.0.1:${(server.address() as { port: number }).port}/missing`,
        path.join(dir, "file"),
        { accessToken: "example-token" },
      ),
      undefined,
    );
  } finally {
    server.close();
    server.closeAllConnections();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
