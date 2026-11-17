import { describe, expect, it } from 'vitest';
import { readConfig } from '../config';
import { extractNotice } from '../extract';
import { liveGate } from '../live/probe';
import { dataUrl } from '../providers/types';
import { form29ModelReply, specimenBytes, stubProvider } from '../test/stub-provider';
import { sniff } from './sniff';

const config = readConfig({});
const reply = () => JSON.stringify(form29ModelReply());

describe('images go to the provider unchanged', () => {
  it('the phone photo arrives as one image/jpeg data URL whose bytes equal the file', async () => {
    const photo = specimenBytes('specimen-2-form29.photo.jpg');
    const provider = stubProvider([reply()]);
    await extractNotice({ bytes: photo }, { config, provider });
    const images = provider.calls[0]!.images;
    expect(images).toHaveLength(1);
    expect(images[0]!.mime).toBe('image/jpeg');
    expect(dataUrl(images[0]!)).toBe(`data:image/jpeg;base64,${Buffer.from(photo).toString('base64')}`);
  });

  it('the PNG arrives as image/png, bytes equal to the file', async () => {
    const png = specimenBytes('specimen-2-form29.png');
    const provider = stubProvider([reply()]);
    await extractNotice({ bytes: png }, { config, provider });
    expect(provider.calls[0]!.images).toEqual([{ mime: 'image/png', bytes: png }]);
  });
});

const gate = await liveGate('PDF pages to the provider', 'chromium', { config: readConfig() });

describe.skipIf(gate.skip)('PDF pages', () => {
  it('a PDF gives one image/png per page', async () => {
    const provider = stubProvider([reply()]);
    const r = await extractNotice({ bytes: specimenBytes('specimen-2-form29.pdf') }, { config, provider });
    expect(r.ok).toBe(true);
    const images = provider.calls[0]!.images;
    expect(images.length).toBeGreaterThanOrEqual(1);
    for (const img of images) {
      expect(img.mime).toBe('image/png');
      expect(sniff(img.bytes)).toBe('png');
    }
  }, 60_000);

  it('a PDF over the page cap is too_many_pages and never reaches the provider', async () => {
    const provider = stubProvider([reply()]);
    const r = await extractNotice({ bytes: specimenBytes('specimen-2-form29.pdf') }, { config: readConfig({ EXTRACT_MAX_PAGES: '0' }), provider });
    expect(r).toMatchObject({ ok: false, reason: 'too_many_pages' });
    expect(provider.calls).toHaveLength(0);
  }, 60_000);
});
