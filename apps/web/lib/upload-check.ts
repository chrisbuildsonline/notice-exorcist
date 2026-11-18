import { imageInfo, sniff } from '@notice-exorcist/notice-extract';
import { MAX_BYTES, MAX_PIXELS } from './limits';
import { EMPTY, HEIC_HINT, NOT_SUPPORTED, oversize, TOO_MANY_PIXELS, UNREADABLE_IMAGE } from './upload-messages';

const MIME = { pdf: 'application/pdf', png: 'image/png', jpeg: 'image/jpeg' } as const;

export type UploadCode = 'empty' | 'too_big' | 'not_supported' | 'heic' | 'unreadable_image' | 'too_many_pixels';

export type UploadCheck =
  | { ok: true; mime: string; width?: number; height?: number }
  | { ok: false; status: 413 | 415 | 422; code: UploadCode; error: string };

const HEIC_BRANDS = new Set(['heic', 'heix', 'mif1']);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
/** An ISO-BMFF file whose `ftyp` major brand is a HEIC/HEIF one (what an iPhone saves by default). */
const isHeic = (b: Uint8Array) => ascii(b, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(b, 8, 12));

/**
 * The one upload check, for the Dropzone route and email attachments. In order: empty (422), over 10 MB (413),
 * type by magic bytes, never the name (415), then for images the header size: unreadable or over 100 megapixels (422).
 * Tall and wide images pass; nothing is cropped or changed.
 */
export function checkUpload(bytes: Uint8Array): UploadCheck {
  if (bytes.byteLength === 0) return { ok: false, status: 422, code: 'empty', error: EMPTY };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, status: 413, code: 'too_big', error: oversize(bytes.byteLength) };
  const type = sniff(bytes);
  if (!type) {
    return isHeic(bytes)
      ? { ok: false, status: 415, code: 'heic', error: `${NOT_SUPPORTED} ${HEIC_HINT}` }
      : { ok: false, status: 415, code: 'not_supported', error: NOT_SUPPORTED };
  }
  if (type === 'pdf') return { ok: true, mime: MIME.pdf };
  const size = imageInfo(bytes);
  if (!size) return { ok: false, status: 422, code: 'unreadable_image', error: UNREADABLE_IMAGE };
  if (size.width * size.height > MAX_PIXELS) return { ok: false, status: 422, code: 'too_many_pixels', error: TOO_MANY_PIXELS };
  return { ok: true, mime: MIME[type], ...size };
}
