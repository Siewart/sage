import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crc32 } from "node:zlib";
import { extractZip } from "../src/zip.js";

function zip(name: string, text: string): Buffer {
  const filename = Buffer.from(name),
    data = Buffer.from(text);
  const local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc32(data), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + data.length, 16);
  return Buffer.concat([local, filename, data, central, filename, end]);
}
test("archive extraction publishes complete files and reuses the cache", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sage-zip-"));
  try {
    const archive = path.join(dir, "match.zip");
    fs.writeFileSync(archive, zip("match/entities.parquet", "example"));
    const files = await extractZip(archive, path.join(dir, "tables"));
    assert.equal(
      fs.readFileSync(files["entities.parquet"]!, "utf8"),
      "example",
    );
    assert.deepEqual(
      await extractZip(archive, path.join(dir, "tables")),
      files,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("archive traversal is rejected without publishing an incomplete directory", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sage-zip-"));
  try {
    const archive = path.join(dir, "match.zip");
    fs.writeFileSync(archive, zip("../escaped", "bad"));
    await assert.rejects(extractZip(archive, path.join(dir, "tables")));
    assert.equal(fs.existsSync(path.join(dir, "escaped")), false);
    assert.equal(fs.existsSync(path.join(dir, "tables")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("corrupt archive contents fail CRC validation and remain unpublished", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sage-zip-crc-"));
  try {
    const archive = path.join(dir, "match.zip");
    const bytes = zip("entities.parquet", "valid");
    bytes[30 + Buffer.byteLength("entities.parquet")] = 0;
    fs.writeFileSync(archive, bytes);
    await assert.rejects(
      extractZip(archive, path.join(dir, "tables")),
      /CRC mismatch/,
    );
    assert.equal(fs.existsSync(path.join(dir, "tables")), false);
    assert.ok(!fs.readdirSync(dir).some((name) => name.endsWith(".partial")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
