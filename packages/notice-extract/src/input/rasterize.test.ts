import { describe, expect, it } from 'vitest';
import { readConfig } from '../config';
import { liveGate } from '../live/probe';
import { specimenBytes } from '../test/stub-provider';
import { rasterize } from './rasterize';
import { sniff } from './sniff';

const gate = await liveGate('rasterize specimen PDFs', 'chromium', { config: readConfig() });

/** Width and height from the PNG IHDR chunk. */
const pngSize = (b: Uint8Array) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
};

describe.skipIf(gate.skip)('rasterize (pdf.js in Playwright Chromium)', () => {
  it.each(['specimen-1-form28.pdf', 'specimen-2-form29.pdf', 'specimen-3-courier.pdf'])(
    'renders %s to PNG pages over 800 px, within the page cap',
    async (name) => {
      const r = await rasterize(specimenBytes(name), { maxPages: 5 });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.pages.length).toBeGreaterThanOrEqual(1);
      expect(r.pages.length).toBeLessThanOrEqual(5);
      for (const page of r.pages) {
        expect(sniff(page)).toBe('png');
        const { width, height } = pngSize(page);
        expect(width).toBeGreaterThan(800);
        expect(height).toBeGreaterThan(800);
      }
    },
    60_000,
  );

  it('returns too_many_pages when the cap is below the page count (EXTRACT_MAX_PAGES=0)', async () => {
    const { maxPages } = readConfig({ EXTRACT_MAX_PAGES: '0' });
    expect(await rasterize(specimenBytes('specimen-2-form29.pdf'), { maxPages })).toEqual({ ok: false, reason: 'too_many_pages' });
  }, 60_000);
});
