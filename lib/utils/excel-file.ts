/**
 * SheetJS always adds xl/metadata.xml (dynamic-array metadata). Desktop Excel
 * closes itself when it opens that part. Rewrite the workbook without it, and
 * store text in the shared string table so cells are ordinary labels.
 */

import type { WorkBook } from "xlsx";

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(view: Uint8Array, offset: number): number {
  return view[offset] | (view[offset + 1] << 8);
}

function u32(view: Uint8Array, offset: number): number {
  return (
    (view[offset] |
      (view[offset + 1] << 8) |
      (view[offset + 2] << 16) |
      (view[offset + 3] << 24)) >>>
    0
  );
}

function putU16(view: Uint8Array, offset: number, value: number) {
  view[offset] = value & 0xff;
  view[offset + 1] = (value >>> 8) & 0xff;
}

function putU32(view: Uint8Array, offset: number, value: number) {
  view[offset] = value & 0xff;
  view[offset + 1] = (value >>> 8) & 0xff;
  view[offset + 2] = (value >>> 16) & 0xff;
  view[offset + 3] = (value >>> 24) & 0xff;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (data.length === 0) return new Uint8Array(0);
  const copy = new Uint8Array(data);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(data);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type ZipEntry = { name: string; data: Uint8Array };

async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && u32(bytes, offset) === 0x04034b50) {
    const flags = u16(bytes, offset + 6);
    const method = u16(bytes, offset + 8);
    let compressedSize = u32(bytes, offset + 18);
    const nameLength = u16(bytes, offset + 26);
    const extraLength = u16(bytes, offset + 28);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    let dataStart = nameStart + nameLength + extraLength;

    if (flags & 0x08) {
      throw new Error("Unexpected zip data descriptor in workbook");
    }
    if (compressedSize === 0xffffffff) {
      throw new Error("Unexpected zip64 workbook");
    }

    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let data: Uint8Array;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error(`Unsupported zip method ${method}`);

    if (name && !name.endsWith("/")) entries.push({ name, data });
    offset = dataStart + compressedSize;
  }

  return entries;
}

function dosStamp(now = new Date()): { time: number; date: number } {
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
}

async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const stamp = dosStamp();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const compressed = await deflateRaw(entry.data);
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    putU32(local, 0, 0x04034b50);
    putU16(local, 4, 20);
    putU16(local, 6, 0x0800);
    putU16(local, 8, 8);
    putU16(local, 10, stamp.time);
    putU16(local, 12, stamp.date);
    putU32(local, 14, crc);
    putU32(local, 18, compressed.length);
    putU32(local, 22, entry.data.length);
    putU16(local, 26, nameBytes.length);
    putU16(local, 28, 0);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    putU32(central, 0, 0x02014b50);
    putU16(central, 4, 20);
    putU16(central, 6, 20);
    putU16(central, 8, 0x0800);
    putU16(central, 10, 8);
    putU16(central, 12, stamp.time);
    putU16(central, 14, stamp.date);
    putU32(central, 16, crc);
    putU32(central, 20, compressed.length);
    putU32(central, 24, entry.data.length);
    putU16(central, 28, nameBytes.length);
    putU16(central, 30, 0);
    putU16(central, 32, 0);
    putU16(central, 34, 0);
    putU16(central, 36, 0);
    putU32(central, 38, 0);
    putU32(central, 42, offset);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  putU32(eocd, 0, 0x06054b50);
  putU16(eocd, 8, entries.length);
  putU16(eocd, 10, entries.length);
  putU32(eocd, 12, centralSize);
  putU32(eocd, 16, offset);

  const total =
    locals.reduce((sum, part) => sum + part.length, 0) + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of locals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centrals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(eocd, cursor);
  return out;
}

function withoutMetadata(xml: string): string {
  return xml
    .replace(/<Override\b[^>]*PartName="\/xl\/metadata\.xml"[^>]*\/>/g, "")
    .replace(/<Relationship\b[^>]*Target="metadata\.xml"[^>]*\/>/g, "");
}

/** Drop the SheetJS metadata part that makes desktop Excel quit on open. */
export async function stripSheetMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const entries = await readZip(bytes);
  const kept: ZipEntry[] = [];

  for (const entry of entries) {
    if (entry.name === "xl/metadata.xml") continue;
    if (entry.name === "[Content_Types].xml" || entry.name === "xl/_rels/workbook.xml.rels") {
      const xml = withoutMetadata(new TextDecoder().decode(entry.data));
      kept.push({ name: entry.name, data: new TextEncoder().encode(xml) });
      continue;
    }
    kept.push(entry);
  }

  return writeZip(kept);
}

function asBytes(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return Uint8Array.from(raw as number[]);
  if (raw && typeof raw === "object" && ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  throw new Error("Unexpected workbook bytes");
}

export async function writeExcelWorkbook(book: WorkBook): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const raw = XLSX.write(book, {
    type: "array",
    bookType: "xlsx",
    bookSST: true,
  });
  return stripSheetMetadata(asBytes(raw));
}
