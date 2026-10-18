import test from "node:test";
import assert from "node:assert/strict";
import { zipExtractedBytes } from "../src/zip-metadata.js";
function archive() {
  const content = new Uint8Array(100000),
    central = new Uint8Array(46),
    end = new Uint8Array(22);
  const c = new DataView(central.buffer),
    e = new DataView(end.buffer);
  c.setUint32(0, 0x02014b50, true);
  c.setUint32(24, 350000, true);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, 1, true);
  e.setUint16(10, 1, true);
  e.setUint32(12, 46, true);
  e.setUint32(16, content.length, true);
  const bytes = new Uint8Array(content.length + 68);
  bytes.set(central, content.length);
  bytes.set(end, content.length + 46);
  return bytes;
}
test("ZIP space preview reads only the tail and returns uncompressed bytes", async () => {
  const bytes = archive(),
    reads: number[] = [];
  assert.equal(
    await zipExtractedBytes(bytes.length, async (start, end) => {
      reads.push(end - start + 1);
      return bytes.slice(start, end + 1);
    }),
    350000,
  );
  assert.deepEqual(reads, [65557]);
});
test("malformed directory sizes are unknown rather than falsely small", async () => {
  const bytes = archive();
  new DataView(bytes.buffer).setUint32(bytes.length - 6, 0xfffffff0, true);
  assert.equal(
    await zipExtractedBytes(bytes.length, async (start, end) =>
      bytes.slice(start, end + 1),
    ),
    undefined,
  );
});
test("ZIP64 preserves extracted sizes above 4 GiB", async () => {
  const offset = 100000,
    centralSize = 58,
    bytes = new Uint8Array(offset + centralSize + 56 + 20 + 22),
    v = new DataView(bytes.buffer);
  v.setUint32(offset, 0x02014b50, true);
  v.setUint32(offset + 24, 0xffffffff, true);
  v.setUint16(offset + 30, 12, true);
  v.setUint16(offset + 46, 1, true);
  v.setUint16(offset + 48, 8, true);
  v.setBigUint64(offset + 50, 10n * 1024n ** 3n, true);
  const z = offset + centralSize;
  v.setUint32(z, 0x06064b50, true);
  v.setBigUint64(z + 4, 44n, true);
  v.setBigUint64(z + 24, 1n, true);
  v.setBigUint64(z + 32, 1n, true);
  v.setBigUint64(z + 40, BigInt(centralSize), true);
  v.setBigUint64(z + 48, BigInt(offset), true);
  const l = z + 56;
  v.setUint32(l, 0x07064b50, true);
  v.setBigUint64(l + 8, BigInt(z), true);
  v.setUint32(l + 16, 1, true);
  const e = l + 20;
  v.setUint32(e, 0x06054b50, true);
  v.setUint16(e + 8, 0xffff, true);
  v.setUint16(e + 10, 0xffff, true);
  v.setUint32(e + 12, 0xffffffff, true);
  v.setUint32(e + 16, 0xffffffff, true);
  assert.equal(
    await zipExtractedBytes(bytes.length, async (start, end) =>
      bytes.slice(start, end + 1),
    ),
    10 * 1024 ** 3,
  );
});
