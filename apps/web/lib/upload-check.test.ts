import { describe, expect, it } from 'vitest';
import { heicHeader, jpegHeader, pngHeader } from '../../../packages/notice-extract/src/test/image-headers';
import { MAX_BYTES } from './limits';
import { specimenBytes } from './test-env';
import { checkUpload } from './upload-check';
import { EMPTY, HEIC_HINT, NOT_SUPPORTED, oversize, OVERSIZE, TOO_MANY_PIXELS, UNREADABLE_IMAGE } from './upload-messages';

const pdf = (size: number) => {
  const b = new Uint8Array(size);
  b.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  return b;
};

describe('checkUpload (R6)', () => {
  it('rejects an empty file with 422', () => {
    expect(checkUpload(new Uint8Array())).toEqual({ ok: false, status: 422, code: 'empty', error: EMPTY });
    expect(EMPTY).toBe('That file is empty.');
  });

  it('rejects 10 MB + 1 byte with 413 and a message that gives the size and the limit', () => {
    const r = checkUpload(pdf(MAX_BYTES + 1));
    expect(r).toMatchObject({ ok: false, status: 413, code: 'too_big' });
    expect(OVERSIZE).toBe('That file is over 10 MB. Try a smaller photo, or a lower-resolution scan.');
    expect(!r.ok && r.error).toBe(`${OVERSIZE} This one is 10.1 MB; the limit is 10.0 MB.`);
    expect(oversize(MAX_BYTES + 1)).toBe(!r.ok && r.error);
    expect(checkUpload(pdf(MAX_BYTES)).ok).toBe(true);
  });

  it('decides the type by bytes: an .exe is 415 whatever it is called', () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(checkUpload(exe)).toEqual({ ok: false, status: 415, code: 'not_supported', error: NOT_SUPPORTED });
    expect(NOT_SUPPORTED).toBe('That file is not a PDF, PNG or JPEG.');
    expect(checkUpload(new TextEncoder().encode('GIF89a\x01\x00\x01\x00')).ok).toBe(false);
    expect(checkUpload(new TextEncoder().encode('RIFF\x00\x00\x00\x00WEBPVP8 ')).ok).toBe(false);
  });

  it('gives HEIC the iPhone hint, for each HEIC brand', () => {
    for (const brand of ['heic', 'heix', 'mif1']) {
      expect(checkUpload(heicHeader(brand))).toEqual({ ok: false, status: 415, code: 'heic', error: `${NOT_SUPPORTED} ${HEIC_HINT}` });
    }
    expect(HEIC_HINT).toBe('On iPhone, choose Most Compatible in Camera settings, or share the photo as JPEG.');
  });

  it('refuses an image over 100 megapixels before decoding it', () => {
    expect(checkUpload(pngHeader(12000, 12000))).toEqual({ ok: false, status: 422, code: 'too_many_pixels', error: TOO_MANY_PIXELS });
    expect(checkUpload(jpegHeader(12000, 12000, { sof: 0xc2 }))).toMatchObject({ code: 'too_many_pixels' });
    expect(TOO_MANY_PIXELS).toBe('That image is too large to read. Try a smaller photo.');
    expect(checkUpload(pngHeader(10000, 10000)).ok).toBe(true);
  });

  it('refuses a PNG or JPEG whose header cannot be read', () => {
    expect(checkUpload(pngHeader(100, 100).slice(0, 20))).toEqual({ ok: false, status: 422, code: 'unreadable_image', error: UNREADABLE_IMAGE });
  });

  it('accepts tall and wide images, with their size, and leaves the bytes alone', () => {
    const tall = pngHeader(800, 3000);
    const copy = tall.slice();
    expect(checkUpload(tall)).toEqual({ ok: true, mime: 'image/png', width: 800, height: 3000 });
    expect(tall).toEqual(copy);
    expect(checkUpload(jpegHeader(3000, 800, { sof: 0xc0 }))).toEqual({ ok: true, mime: 'image/jpeg', width: 3000, height: 800 });
  });

  it('accepts the bundled specimens: PDF, PNG and the phone photo', () => {
    expect(checkUpload(specimenBytes('specimen-2-form29.pdf'))).toEqual({ ok: true, mime: 'application/pdf' });
    expect(checkUpload(specimenBytes('specimen-2-form29.png'))).toMatchObject({ ok: true, mime: 'image/png' });
    expect(checkUpload(specimenBytes('specimen-2-form29.photo.jpg'))).toMatchObject({ ok: true, mime: 'image/jpeg' });
  });
});
