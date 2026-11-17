import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { call, connect, textOf } from './harness.bun.test';

type Ruling = { number: string; date: string; title: string; htsCodes: string[]; url: string; snippet?: string };
type Result = { notice: string; count: number; rulings: Ruling[] };

const NOTICE = 'Candidate rulings for review. Not a classification and not legal advice.';

let client: Client;
beforeAll(async () => {
  client = await connect();
}, 15_000);
afterAll(() => client?.close());

const search = async (args: Record<string, unknown>) => {
  const r = await call(client, 'search_rulings', args);
  expect(r.isError).toBeFalsy();
  return r.structuredContent as Result;
};
const cites = (r: Ruling, prefix: string) => r.htsCodes.some((c) => c.startsWith(prefix));

describe('search_rulings', () => {
  test('a text query returns candidate rulings with number, date, title, codes, url, snippet and the notice', async () => {
    const s = await search({ query: 'cotton t-shirt' });
    expect(s.notice).toBe(NOTICE);
    expect(s.count).toBe(s.rulings.length);
    expect(s.count).toBeGreaterThan(0);
    expect(s.count).toBeLessThanOrEqual(10);
    for (const r of s.rulings) {
      expect(r.number).toMatch(/^[NH]\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.title.length).toBeGreaterThan(0);
      expect(Array.isArray(r.htsCodes)).toBe(true);
      expect(r.url.startsWith('https://rulings.cbp.gov')).toBe(true);
      expect(typeof r.snippet).toBe('string');
    }
  });

  test('htsPrefix alone returns only rulings citing that prefix, without snippets', async () => {
    const s = await search({ htsPrefix: '6109', limit: 25 });
    expect(s.notice).toBe(NOTICE);
    expect(s.count).toBeGreaterThan(0);
    for (const r of s.rulings) {
      expect(cites(r, '6109')).toBe(true);
      expect('snippet' in r).toBe(false);
    }
    expect(s.rulings.map((r) => r.number)).toContain('N352158');
  });

  test('query plus prefix returns rulings that satisfy both', async () => {
    const both = await search({ query: 'Haiti', htsPrefix: '6109.10', limit: 25 });
    const byQuery = (await search({ query: 'Haiti', limit: 25 })).rulings.map((r) => r.number);
    const byPrefix = (await search({ htsPrefix: '6109.10', limit: 25 })).rulings.map((r) => r.number);
    expect(byQuery.length).toBeLessThan(25); // the whole query result fits, so the subset check below is complete
    expect(both.count).toBeGreaterThan(0);
    expect(both.rulings.map((r) => r.number)).toContain('N352158');
    for (const r of both.rulings) {
      expect(byQuery).toContain(r.number);
      expect(byPrefix).toContain(r.number);
      expect(cites(r, '6109.10')).toBe(true);
      expect(typeof r.snippet).toBe('string');
    }
    expect(both.count).toBeLessThanOrEqual(Math.min(byQuery.length, byPrefix.length));
  });

  test('a nonsense query returns an empty list, not an error', async () => {
    const s = await search({ query: 'zzqxv wqkzzj' });
    expect(s).toEqual({ notice: NOTICE, count: 0, rulings: [] });
  });

  test('neither query nor htsPrefix is a tool error', async () => {
    const r = await call(client, 'search_rulings', {});
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('query');
  });

  test('limit 26 is a tool error naming limit', async () => {
    const r = await call(client, 'search_rulings', { query: 'cotton', limit: 26 });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('limit');
  });

  test('a malformed prefix is a tool error with invalid_code', async () => {
    const r = await call(client, 'search_rulings', { htsPrefix: "61%' OR 1=1" });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toEqual({ status: 'invalid_code', code: "61%' OR 1=1" });
  });
});
