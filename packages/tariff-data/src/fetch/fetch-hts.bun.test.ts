import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCOPE_CHAPTERS } from '../config';
import { fetchHts } from './hts';

// Verbatim USITC export formatting (first row of chapter 61, 2026 HTS Revision 23).
const row = (htsno: string) => `{
  "htsno" : "${htsno}",
  "indent" : "0",
  "description" : "Men's or boys' overcoats, carcoats, capes, cloaks, anoraks (including ski-jackets), windbreakers and similar articles, knitted or crocheted, other than those of heading 6103:",
  "superior" : null,
  "units" : [ ],
  "general" : "",
  "special" : "",
  "other" : "",
  "footnotes" : [ ],
  "quotaQuantity" : "",
  "additionalDuties" : "",
  "addiitionalDuties" : null
}`;
const exportBody = (ch: string) => `[ ${row(`${ch}01`)} ]`;
const release = JSON.stringify({ name: '2026HTSRev23', description: '2026 HTS Revision 23', title: 'Revision 23 (2026)' });

function fakeFetch(override: Record<string, string> = {}) {
  const urls: string[] = [];
  const fn = async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/currentRelease')) return new Response(release);
    const ch = new URL(url).searchParams.get('from')!.slice(0, 2);
    return new Response(override[ch] ?? exportBody(ch));
  };
  return { fn: fn as typeof fetch, urls };
}

const tmp = () => mkdtempSync(join(tmpdir(), 'hts-fetch-'));

describe('fetchHts', () => {
  test('requests each scope chapter once and writes the raw bytes unchanged', async () => {
    const dir = tmp();
    const { fn, urls } = fakeFetch();
    const res = await fetchHts(dir, fn);

    const exportUrls = urls.filter((u) => u.includes('exportList'));
    expect(exportUrls).toHaveLength(SCOPE_CHAPTERS.length);
    expect(exportUrls.map((u) => new URL(u).searchParams.get('from'))).toEqual(SCOPE_CHAPTERS.map((c) => `${c}00`));
    expect(exportUrls[0]).toBe('https://hts.usitc.gov/reststop/exportList?from=3900&to=3999&format=JSON&styles=false');

    expect(readFileSync(join(dir, 'hts', 'ch61.json'), 'utf8')).toBe(exportBody('61'));
    expect(res.edition).toBe('2026 HTS Revision 23');
    const entry = res.files['hts/ch61.json']!;
    expect(entry.url).toContain('from=6100');
    expect(entry.sha256).toBe(new Bun.CryptoHasher('sha256').update(exportBody('61')).digest('hex'));
    expect(existsSync(join(dir, 'hts', 'ch61.json.tmp'))).toBe(false);
  });

  for (const [name, body] of [
    ['invalid JSON', '[ { "htsno" : '],
    ['an empty list', '[ ]'],
    ['a row missing general', '[ { "htsno": "6401", "indent": "0", "description": "x", "units": [], "special": "", "other": "" } ]'],
  ] as const) {
    test(`fails on ${name}, names the chapter and leaves stored files alone`, async () => {
      const dir = tmp();
      mkdirSync(join(dir, 'hts'));
      writeFileSync(join(dir, 'hts', 'ch39.json'), 'old 39');
      writeFileSync(join(dir, 'hts', 'ch64.json'), 'old 64');
      const { fn } = fakeFetch({ '64': body });
      await expect(fetchHts(dir, fn)).rejects.toThrow(/chapter 64/);
      expect(readFileSync(join(dir, 'hts', 'ch39.json'), 'utf8')).toBe('old 39');
      expect(readFileSync(join(dir, 'hts', 'ch64.json'), 'utf8')).toBe('old 64');
    });
  }

  test('fails when a row belongs to another chapter', async () => {
    const { fn } = fakeFetch({ '42': exportBody('43') });
    await expect(fetchHts(tmp(), fn)).rejects.toThrow(/chapter 42/);
  });

  test('fails on an HTTP error', async () => {
    const fn = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    await expect(fetchHts(tmp(), fn)).rejects.toThrow(/503/);
  });
});
