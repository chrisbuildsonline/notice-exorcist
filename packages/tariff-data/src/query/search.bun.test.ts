import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from '../build/build';
import { DATA_DIR } from '../config';
import { openIndex, searchHts, searchRulings, toFtsExpression } from './index';

const path = join(mkdtempSync(join(tmpdir(), 'tariff-search-')), 'tariff.sqlite');
buildIndex(DATA_DIR, path);
const db = openIndex(path);
afterAll(() => db.close());

const nasty = ['"', '""', '*', 'cotton*', 'NEAR(', 'NEAR(cotton shirt)', '-', '-cotton', 'title:cotton', ':', 'a AND', 'OR', 'NOT', '(', ')', '^shirt', "'; DROP TABLE rulings; --", '\u0000', '   ', ''];

describe('toFtsExpression', () => {
  test('quotes every token and joins with AND or OR', () => {
    expect(toFtsExpression('cotton t-shirt knitted', 'and')).toBe('"cotton" AND "t" AND "shirt" AND "knitted"');
    expect(toFtsExpression('cotton t-shirt', 'or')).toBe('"cotton" OR "t" OR "shirt"');
  });

  test('keeps FTS5 operators as plain quoted words and drops punctuation', () => {
    expect(toFtsExpression('NEAR(cotton* -shirt) title:"x"', 'and')).toBe('"NEAR" AND "cotton" AND "shirt" AND "title" AND "x"');
  });

  test('returns null when there is no alphanumeric token', () => {
    for (const q of ['', '   ', '"', '*', '-', ':', '()']) expect(toFtsExpression(q, 'and')).toBeNull();
  });
});

describe('searchHts', () => {
  test('finds lines by description, ranked, with verbatim rate text and provenance', () => {
    const hits = searchHts(db, 'singlets cotton', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(5);
    const h = hits.find((x) => x.code === '6109.10.00.07');
    expect(h?.general).toBe('');
    expect(h?.prov.kind).toBe('tariff');
    expect(hits.every((x) => x.code !== '')).toBe(true);
  });

  test('falls back to OR when AND finds nothing', () => {
    expect(searchHts(db, 'singlets zzqqxx').length).toBeGreaterThan(0);
  });

  test('never throws on FTS5 syntax characters and returns [] for empty input', () => {
    for (const q of nasty) expect(() => searchHts(db, q)).not.toThrow();
    expect(searchHts(db, '')).toEqual([]);
    expect(searchHts(db, '"*-')).toEqual([]);
  });
});

describe('searchRulings', () => {
  test('returns ranked rulings with citations and a snippet, no verdict', () => {
    const hits = searchRulings(db, 'cotton t-shirt knitted', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(Object.keys(h).sort()).toEqual(['date', 'htsCodes', 'number', 'snippet', 'title', 'url']);
      expect(h.url).toBe(`https://rulings.cbp.gov/ruling/${h.number}`);
      expect(h.snippet.length).toBeGreaterThan(0);
    }
  });

  test('heading and chapter filters keep only rulings with a matching code', () => {
    const byHeading = searchRulings(db, 'cotton', { heading: '6109', limit: 50 });
    expect(byHeading.length).toBeGreaterThan(0);
    expect(byHeading.every((h) => h.htsCodes.some((c) => c.startsWith('6109')))).toBe(true);
    const byChapter = searchRulings(db, 'cotton', { chapter: '62', limit: 50 });
    expect(byChapter.every((h) => h.htsCodes.some((c) => c.startsWith('62')))).toBe(true);
    expect(searchRulings(db, 'cotton', { heading: '0101' })).toEqual([]);
  });

  test('falls back to OR when AND finds nothing', () => {
    expect(searchRulings(db, 'cotton zzqqxx').length).toBeGreaterThan(0);
  });

  test('never throws on FTS5 syntax characters and returns [] for empty input', () => {
    for (const q of nasty) expect(() => searchRulings(db, q)).not.toThrow();
    expect(searchRulings(db, '')).toEqual([]);
  });
});
