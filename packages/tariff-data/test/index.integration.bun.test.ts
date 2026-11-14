import { afterAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, SCOPE_CHAPTERS } from '../src/config';
import { lookupHts, searchHts, searchRulings } from '../src/query';
import { freshIndex } from './helpers';

const db = freshIndex();
afterAll(() => db.close());

describe('built index', () => {
  test('lookup of 6109.10.00 returns the general text from the snapshot byte for byte', () => {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, 'hts', 'ch61.json'), 'utf8')) as { htsno: string; general: string }[];
    const expected = raw.find((r) => r.htsno === '6109.10.00')!.general;
    const r = lookupHts(db, '6109.10.00');
    expect(r.status === 'ok' && Buffer.from(r.general).equals(Buffer.from(expected))).toBe(true);
    expect(expected).toBe('16.5%');
  });

  test('a malformed code is invalid_code and an out-of-scope code is out_of_scope', () => {
    expect(lookupHts(db, '61O9.10.00')).toEqual({ status: 'invalid_code', code: '61O9.10.00' });
    expect(lookupHts(db, '8471.30.01.00')).toEqual({ status: 'out_of_scope', code: '8471.30.01.00' });
  });

  test('"cotton t-shirt knitted" has a ruling classified under 6109 in the top five', () => {
    const top = searchRulings(db, 'cotton t-shirt knitted', { limit: 5 });
    expect(top.some((h) => h.htsCodes.some((c) => c.startsWith('6109')))).toBe(true);
  });

  test('queries with FTS5 syntax characters do not throw', () => {
    for (const q of ['"', 'cotton"', '*', 'shirt*', 'NEAR(', 'NEAR(a b, 2)', '-', '-cotton', ':', 'text:cotton', '{title}: x', 'AND OR NOT', '']) {
      expect(() => searchRulings(db, q)).not.toThrow();
      expect(() => searchHts(db, q)).not.toThrow();
    }
  });

  test('every scope chapter has HTS lines and no line belongs to another chapter', () => {
    const counts = db.query('SELECT chapter, count(*) AS n FROM hts_lines GROUP BY chapter ORDER BY chapter').all() as { chapter: string; n: number }[];
    expect(counts.map((c) => c.chapter)).toEqual([...SCOPE_CHAPTERS]);
    expect(counts.every((c) => c.n > 0)).toBe(true);
    expect(db.query("SELECT count(*) AS n FROM hts_lines WHERE code <> '' AND substr(code, 1, 2) <> chapter").get()).toEqual({ n: 0 });
  });

  test('at least five rulings are classified under 6109', () => {
    expect((db.query("SELECT count(DISTINCT number) AS n FROM ruling_codes WHERE heading = '6109'").get() as { n: number }).n).toBeGreaterThanOrEqual(5);
  });
});
