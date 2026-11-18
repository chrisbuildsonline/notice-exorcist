export type ImageInfo = { width: number; height: number };

const be16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const be32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const sized = (width: number, height: number): ImageInfo | null => (width > 0 && height > 0 ? { width, height } : null);

/** PNG: the IHDR chunk follows the 8-byte signature; width and height sit at bytes 16 to 24. */
function png(b: Uint8Array): ImageInfo | null {
  const ihdr = b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52;
  return b.length >= 24 && ihdr ? sized(be32(b, 16), be32(b, 20)) : null;
}

/** SOF0 to SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but do not. */
const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/** JPEG: walk the marker segments after SOI until the first SOF; stop at SOS or anything malformed. */
function jpeg(b: Uint8Array): ImageInfo | null {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1]!;
    if (m === 0xff) {
      i++; // fill byte
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2; // markers with no length
      continue;
    }
    if (m === 0xd9 || m === 0xda) return null;
    const len = be16(b, i + 2);
    if (len < 2) return null;
    if (isSof(m)) return len >= 8 && i + 2 + len <= b.length ? sized(be16(b, i + 7), be16(b, i + 5)) : null;
    i += 2 + len;
  }
  return null;
}

/**
 * Width and height from a PNG or JPEG header, without decoding the picture. Null for any other type
 * or a header that is cut short or malformed. Lets the server refuse decompression bombs cheaply.
 */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return png(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes);
  return null;
}
