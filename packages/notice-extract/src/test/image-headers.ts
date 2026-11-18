/** Tiny image files built from code for tests: a valid header plus padding, never a decodable picture. */

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

/** PNG signature and an IHDR chunk with the given size (CRC left zero), then `pad` zero bytes. */
export function pngHeader(width: number, height: number, pad = 16): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32(13), 0x49, 0x48, 0x44, 0x52, ...u32(width), ...u32(height), 8, 6, 0, 0, 0, ...u32(0),
    ...new Array<number>(pad).fill(0),
  ]);
}

/** SOI, optional APP1 of `app1` payload bytes and a DHT, then a SOF (`sof` marker) with the given size. */
export function jpegHeader(width: number, height: number, opts: { sof: number; app1?: number; dht?: boolean }): Uint8Array {
  const seg = (marker: number, payload: number[]) => [0xff, marker, ...u16(payload.length + 2), ...payload];
  return new Uint8Array([
    0xff, 0xd8,
    ...(opts.app1 ? seg(0xe1, new Array<number>(opts.app1).fill(0x41)) : []),
    ...(opts.dht ? seg(0xc4, new Array<number>(20).fill(0)) : []),
    ...seg(opts.sof, [8, ...u16(height), ...u16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
    0xff, 0xd9,
  ]);
}

/** An ISO-BMFF `ftyp` box with the given major brand, as an iPhone HEIC starts. */
export function heicHeader(brand = 'heic'): Uint8Array {
  const enc = new TextEncoder();
  return new Uint8Array([...u32(24), ...enc.encode('ftyp'), ...enc.encode(brand), ...u32(0), ...enc.encode('mif1heic'), ...new Array<number>(16).fill(0)]);
}
