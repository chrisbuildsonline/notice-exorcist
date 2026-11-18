import { describe, expect, it } from 'vitest';
import { specimenBytes } from '../test/stub-provider';
import { jpegHeader, pngHeader } from '../test/image-headers';
import { imageInfo } from './image-info';

describe('imageInfo: width and height from the PNG or JPEG header, no decoding', () => {
  it('reads a tall PNG (100×4000) and a wide PNG (4000×100) from IHDR', () => {
    expect(imageInfo(pngHeader(100, 4000))).toEqual({ width: 100, height: 4000 });
    expect(imageInfo(pngHeader(4000, 100))).toEqual({ width: 4000, height: 100 });
  });

  it('reads a baseline JPEG (SOF0) and a progressive JPEG (SOF2)', () => {
    expect(imageInfo(jpegHeader(640, 480, { sof: 0xc0 }))).toEqual({ width: 640, height: 480 });
    expect(imageInfo(jpegHeader(1200, 5000, { sof: 0xc2 }))).toEqual({ width: 1200, height: 5000 });
  });

  it('skips an APP1 (Exif) segment and a DHT table before the SOF', () => {
    expect(imageInfo(jpegHeader(800, 3000, { sof: 0xc0, app1: 300, dht: true }))).toEqual({ width: 800, height: 3000 });
  });

  it('reads the real specimen photo and PNG', () => {
    const photo = imageInfo(specimenBytes('specimen-2-form29.photo.jpg'));
    const png = imageInfo(specimenBytes('specimen-2-form29.png'));
    expect(photo && photo.width > 0 && photo.height > 0).toBe(true);
    expect(png && png.width > 0 && png.height > 0).toBe(true);
  });

  it('returns null for a truncated header, a zero size, a PDF and an empty file', () => {
    expect(imageInfo(pngHeader(100, 100).slice(0, 20))).toBeNull();
    expect(imageInfo(jpegHeader(640, 480, { sof: 0xc0 }).slice(0, 12))).toBeNull();
    expect(imageInfo(pngHeader(0, 100))).toBeNull();
    expect(imageInfo(new TextEncoder().encode('%PDF-1.7\n'))).toBeNull();
    expect(imageInfo(new Uint8Array())).toBeNull();
  });
});
