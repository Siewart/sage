/** Read ZIP directory sizes without downloading or inflating its file contents. */
export async function zipExtractedBytes(
  size: number,
  read: (start: number, end: number) => Promise<Uint8Array>,
): Promise<number | undefined> {
  const start = Math.max(0, size - 65557),
    tail = await read(start, size - 1);
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === tail.length
    ) {
      end = i;
      break;
    }
  if (end < 0) return;
  let count = view.getUint16(end + 10, true),
    length = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  )
    return;
  if (count === 0xffff || length === 0xffffffff || offset === 0xffffffff) {
    const locator = end - 20;
    if (locator < 0 || view.getUint32(locator, true) !== 0x07064b50) return;
    const absolute = Number(view.getBigUint64(locator + 8, true));
    const header =
      absolute >= start
        ? tail.subarray(absolute - start, absolute - start + 56)
        : await read(absolute, absolute + 55);
    if (header.length < 56) return;
    const z = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (z.getUint32(0, true) !== 0x06064b50) return;
    count = Number(z.getBigUint64(32, true));
    length = Number(z.getBigUint64(40, true));
    offset = Number(z.getBigUint64(48, true));
  }
  if (
    ![count, length, offset].every(Number.isSafeInteger) ||
    length > 4 * 1024 ** 2 ||
    offset + length > size
  )
    return;
  const directory =
    offset >= start
      ? tail.subarray(offset - start, offset - start + length)
      : await read(offset, offset + length - 1);
  if (directory.length !== length) return;
  const central = new DataView(
    directory.buffer,
    directory.byteOffset,
    directory.byteLength,
  );
  let position = 0,
    total = 0;
  for (let index = 0; index < count; index++) {
    if (
      position + 46 > directory.length ||
      central.getUint32(position, true) !== 0x02014b50
    )
      return;
    let bytes = central.getUint32(position + 24, true);
    const name = central.getUint16(position + 28, true),
      extra = central.getUint16(position + 30, true),
      comment = central.getUint16(position + 32, true);
    const next = position + 46 + name + extra + comment;
    if (next > directory.length) return;
    if (bytes === 0xffffffff) {
      let found = false;
      for (
        let p = position + 46 + name;
        p + 4 <= position + 46 + name + extra;

      ) {
        const tag = central.getUint16(p, true),
          n = central.getUint16(p + 2, true);
        if (p + 4 + n > position + 46 + name + extra) return;
        if (tag === 1 && n >= 8) {
          bytes = Number(central.getBigUint64(p + 4, true));
          found = true;
          break;
        }
        p += 4 + n;
      }
      if (!found) return;
    }
    total += bytes;
    if (!Number.isSafeInteger(total)) return;
    position = next;
  }
  return total;
}
