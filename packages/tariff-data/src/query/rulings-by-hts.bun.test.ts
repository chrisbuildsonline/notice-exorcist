import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from '../build/build';
import { DATA_DIR } from '../config';
import { openIndex, rulingsByHtsPrefix } from './index';

const path = join(mkdtempSync(join(tmpdir(), 'tariff-rulings-by-hts-')), 'tariff.sqlite');
buildIndex(DATA_DIR, path);
const db = openIndex(path);
afterAll(() => db.close());

// Expected sets come from the raw CROSS files: digits of each cited code, compared as plain strings.
const rawRulings = readdirSync(join(DATA_DIR, 'rulings')).map(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, 'rulings', f), 'utf8')) as { rulingNumber: string; tariffs: string | null },
);
const rawCiting = (digits: string) =>
  rawRulings
    .filter((r) => (r.tariffs ?? '').split(/[,;\s]+/).some((t) => t.replace(/\D/g, '').startsWith(digits)))
    .map((r) => r.rulingNumber)
    .sort();

const cites = (codes: string[], prefix: string) => codes.some((c) => c.startsWith(prefix));

describe('rulingsByHtsPrefix', () => {
  test('prefix 6109 returns exactly the rulings citing a 6109 code, newest first, with number, date and url', () => {
    const hits = rulingsByHtsPrefix(db, '6109', { limit: 100 });
    expect(hits.map((h) => h.number).sort()).toEqual(rawCiting('6109'));
    expect(hits.map((h) => h.number)).toContain('N352158');
    for (const h of hits) {
      expect(cites(h.htsCodes, '6109')).toBe(true);
      expect(h.number).toMatch(/^[NH]\d+$/);
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(h.url).toBe(`https://rulings.cbp.gov/ruling/${h.number}`);
      expect(h.title.length).toBeGreaterThan(0);
    }
    const dates = hits.map((h) => h.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('a 6-digit prefix narrows the 4-digit result, dots optional', () => {
    const wide = rulingsByHtsPrefix(db, '6109', { limit: 100 }).map((h) => h.number);
    const narrow = rulingsByHtsPrefix(db, '6109.10', { limit: 100 });
    expect(narrow.map((h) => h.number).sort()).toEqual(rawCiting('610910'));
    for (const h of narrow) {
      expect(wide).toContain(h.number);
      expect(cites(h.htsCodes, '6109.10')).toBe(true);
    }
    expect(rulingsByHtsPrefix(db, '610910', { limit: 100 })).toEqual(narrow);
  });

  test('limit caps the result and defaults to 10', () => {
    expect(rawCiting('6109').length).toBeGreaterThan(3);
    expect(rulingsByHtsPrefix(db, '6109', { limit: 3 }).length).toBe(3);
    expect(rulingsByHtsPrefix(db, '6109').length).toBe(Math.min(10, rawCiting('6109').length));
  });

  test('a prefix no ruling cites returns []', () => {
    expect(rawCiting('3901')).toEqual([]);
    expect(rulingsByHtsPrefix(db, '3901')).toEqual([]);
  });

  test('SQL or LIKE wildcards and malformed prefixes match nothing', () => {
    for (const p of ['61%', '6_09', "' OR 1=1", "6109' OR '1'='1", '%', '', '61091']) {
      expect(rulingsByHtsPrefix(db, p, { limit: 100 })).toEqual([]);
    }
  });
});
