import { deflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../config';
import { extractNotice } from '../extract';
import { liveGate } from '../live/probe';
import { jpegHeader, pngHeader } from '../test/image-headers';
import { form29ModelReply, stubProvider } from '../test/stub-provider';
import { imageInfo } from './image-info';
import { fitWithin, MODEL_MAX_SIDE, prepareForModel, type Resize } from './prepare-for-model';
import { sniff } from './sniff';

/** A stub resizer: returns a PNG or JPEG header of the asked size, so the result can be measured. */
const stubResize = vi.fn<Resize>(async (_bytes, mime, size) =>
  mime === 'image/png' ? pngHeader(size.width, size.height) : jpegHeader(size.width, size.height, { sof: 0xc0 }),
);

describe('fitWithin: the longest side down to the limit, aspect ratio kept', () => {
  it('scales tall and wide sizes and leaves small ones', () => {
    expect(fitWithin({ width: 1000, height: 12000 }, 4000)).toEqual({ width: 333, height: 4000 });
    expect(fitWithin({ width: 12000, height: 1000 }, 4000)).toEqual({ width: 4000, height: 333 });
    expect(fitWithin({ width: 800, height: 3000 }, 4000)).toEqual({ width: 800, height: 3000 });
    expect(fitWithin({ width: 1, height: 90000 }, 4000)).toEqual({ width: 1, height: 4000 });
  });
});

describe('prepareForModel: a smaller copy for the model, the original untouched (R6.6)', () => {
  it('reduces a tall image over the limit, keeping the aspect ratio and the type', async () => {
    const tall = pngHeader(1000, 3 * MODEL_MAX_SIDE);
    const before = tall.slice();
    const out = await prepareForModel({ mime: 'image/png', bytes: tall }, { resize: stubResize });
    expect(out.mime).toBe('image/png');
    expect(imageInfo(out.bytes)).toEqual({ width: Math.round(1000 / 3), height: MODEL_MAX_SIDE });
    expect(sniff(out.bytes)).toBe('png');
    // the stored original is the input: not mutated, still a PNG
    expect(tall).toEqual(before);
    expect(sniff(tall)).toBe('png');
  });

  it('reduces a wide JPEG over the limit to a JPEG', async () => {
    const wide = jpegHeader(2 * MODEL_MAX_SIDE, 900, { sof: 0xc2 });
    const out = await prepareForModel({ mime: 'image/jpeg', bytes: wide }, { resize: stubResize });
    expect(out.mime).toBe('image/jpeg');
    expect(imageInfo(out.bytes)).toEqual({ width: MODEL_MAX_SIDE, height: 450 });
    expect(sniff(wide)).toBe('jpeg');
  });

  it('returns an image within the limit as it is, with no resize', async () => {
    stubResize.mockClear();
    const img = { mime: 'image/png' as const, bytes: pngHeader(800, 3000) };
    expect(await prepareForModel(img, { resize: stubResize })).toBe(img);
    expect(stubResize).not.toHaveBeenCalled();
  });

  it('extractNotice sends the reduced copy to the model, and the hash is still of the original', async () => {
    const tall = pngHeader(1200, 2 * MODEL_MAX_SIDE);
    const provider = stubProvider([JSON.stringify(form29ModelReply())]);
    const r = await extractNotice({ bytes: tall }, { config: readConfig({}), provider, resize: stubResize });
    const [img] = provider.calls[0]!.images;
    expect(imageInfo(img!.bytes)).toEqual({ width: 600, height: MODEL_MAX_SIDE });
    expect(r.ok ? r.meta.hash : r.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tall).toEqual(pngHeader(1200, 2 * MODEL_MAX_SIDE));
  });
});

/** A real, decodable greyscale PNG (every row a gradient), built with zlib. */
function realPng(width: number, height: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
  const row = Buffer.alloc(width + 1);
  for (let x = 0; x < width; x++) row[x + 1] = x % 256;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Uint8Array(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const gate = await liveGate('downscale in Chromium', 'chromium', { config: readConfig() });

describe.skipIf(gate.skip)('the Chromium canvas resizer', () => {
  it('draws a tall PNG at the reduced size, as a PNG', async () => {
    const tall = realPng(300, MODEL_MAX_SIDE + 904);
    const out = await prepareForModel({ mime: 'image/png', bytes: tall });
    expect(sniff(out.bytes)).toBe('png');
    expect(imageInfo(out.bytes)).toEqual(fitWithin({ width: 300, height: MODEL_MAX_SIDE + 904 }, MODEL_MAX_SIDE));
  }, 60_000);
});
