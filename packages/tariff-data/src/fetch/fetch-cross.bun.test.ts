import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchRulings } from './cross';

// Shape and values from https://rulings.cbp.gov/api/ruling/N338047 (text cut short; the url is a presigned S3 link).
const record = (n: string, tariffs: string) => ({
  text: `${n} \r\rFebruary 22, 2024 \r\rCLA-2-90:OT:RR:NC:N2:212\r\rCATEGORY: Classification\r\rTARIFF NO.: ${tariffs}\r\r`,
  url: `https://sjn0y7-bemsd-cross-prod.s3.us-east-1.amazonaws.com/ny/2024/${n}.doc?X-Amz-Expires=900&X-Amz-Credential=AKIAEXAMPLE`,
  id: 214300,
  rulingNumber: n,
  subject: 'The tariff classification of children’s swim goggles from China',
  categories: null,
  rulingDate: '2024-02-22T00:00:00',
  collection: 'ny',
  tariffs,
});

function fakeFetch(db: Record<string, unknown>) {
  const calls: { url: string; ua: string | null }[] = [];
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ua: new Headers(init?.headers).get('User-Agent') });
    const n = url.split('/').pop()!;
    return n in db ? new Response(JSON.stringify(db[n])) : new Response('{"message":"not found"}', { status: 404 });
  };
  return { fn: fn as typeof fetch, calls };
}

const tmp = () => mkdtempSync(join(tmpdir(), 'cross-fetch-'));
const noSleep = async () => {};

describe('fetchRulings', () => {
  test('fetches each selected ruling, drops the presigned url, and records the source', async () => {
    const dir = tmp();
    const { fn, calls } = fakeFetch({ N100001: record('N100001', '6109.10.0012') });
    const res = await fetchRulings(dir, { '6109': ['N100001'] }, { fetch: fn, sleep: noSleep });

    expect(calls[0]).toEqual({ url: 'https://rulings.cbp.gov/api/ruling/N100001', ua: expect.stringContaining('notice-exorcist') });
    const saved = JSON.parse(readFileSync(join(dir, 'rulings', 'N100001.json'), 'utf8'));
    expect(saved.url).toBeUndefined();
    expect(saved.tariffs).toBe('6109.10.0012');
    expect(res.files['rulings/N100001.json']?.url).toBe('https://rulings.cbp.gov/api/ruling/N100001');
    expect(res.failures).toEqual([]);
  });

  test('respects the per-heading cap', async () => {
    const db = Object.fromEntries(['N1', 'N2', 'N3'].map((n) => [`${n}00000`, record(`${n}00000`, '6109.90.1007')]));
    const { fn, calls } = fakeFetch(db);
    await fetchRulings(tmp(), { '6109': Object.keys(db) }, { fetch: fn, sleep: noSleep, cap: 2 });
    expect(calls).toHaveLength(2);
  });

  test('skips rulings already stored unless refresh is set', async () => {
    const dir = tmp();
    mkdirSync(join(dir, 'rulings'));
    writeFileSync(join(dir, 'rulings', 'N100001.json'), 'kept');
    const { fn, calls } = fakeFetch({ N100001: record('N100001', '6109.10.0012') });
    await fetchRulings(dir, { '6109': ['N100001'] }, { fetch: fn, sleep: noSleep });
    expect(calls).toHaveLength(0);
    expect(readFileSync(join(dir, 'rulings', 'N100001.json'), 'utf8')).toBe('kept');

    await fetchRulings(dir, { '6109': ['N100001'] }, { fetch: fn, sleep: noSleep, refresh: true });
    expect(calls).toHaveLength(1);
    expect(readFileSync(join(dir, 'rulings', 'N100001.json'), 'utf8')).not.toBe('kept');
  });

  test('continues after a failure and reports every failed number', async () => {
    const dir = tmp();
    const { fn } = fakeFetch({
      N100002: record('N100002', '6109.10.0012'),
      N100003: record('N100003', '9004.90.0090'),
    });
    const res = await fetchRulings(dir, { '6109': ['N100001', 'N100002', 'N100003'] }, { fetch: fn, sleep: noSleep });
    expect(res.failures.map((f) => f.split(':')[0])).toEqual(['N100001', 'N100003']);
    expect(res.failures[1]).toContain('not classified under 6109');
    expect(existsSync(join(dir, 'rulings', 'N100002.json'))).toBe(true);
    expect(existsSync(join(dir, 'rulings', 'N100003.json'))).toBe(false);
  });

  test('waits between requests', async () => {
    const waits: number[] = [];
    const db = { N100001: record('N100001', '6109.10.0012'), N100002: record('N100002', '6109.10.0012') };
    const { fn } = fakeFetch(db);
    await fetchRulings(tmp(), { '6109': Object.keys(db) }, { fetch: fn, sleep: async (ms) => void waits.push(ms), gapMs: 750 });
    expect(waits).toEqual([750, 750]);
  });
});
