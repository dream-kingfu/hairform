const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const encoder = new TextEncoder();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function textChunk(keyword: string, value: string) {
  const safeKeyword = keyword.replaceAll("\0", "").slice(0, 79);
  const type = encoder.encode("tEXt");
  const data = encoder.encode(`${safeKeyword}\0${value}`);
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type); crcInput.set(data, type.length);
  const chunk = new Uint8Array(12 + data.length);
  chunk.set(uint32(data.length), 0);
  chunk.set(type, 4);
  chunk.set(data, 8);
  chunk.set(uint32(crc32(crcInput)), 8 + data.length);
  return chunk;
}

export async function withPngText(blob: Blob, entries: Record<string, string>) {
  const original = new Uint8Array(await blob.arrayBuffer());
  if (original.length < 33 || PNG_SIGNATURE.some((byte, index) => original[index] !== byte)) return blob;
  const firstChunkLength = new DataView(original.buffer, original.byteOffset, original.byteLength).getUint32(8, false);
  const insertionPoint = 8 + 12 + firstChunkLength;
  const chunks = Object.entries(entries).map(([key, value]) => textChunk(key, value));
  return new Blob([original.slice(0, insertionPoint), ...chunks, original.slice(insertionPoint)], { type: "image/png" });
}
