import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { cpSync, existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DATA_DIR, SCOPE_CHAPTERS } from '../config';
import { buildIndex } from './build';

const tmp = () => mkdtempSync(join(tmpdir(), 'tariff-build-'));
const copyData = () => {
  const dir = join(tmp(), 'data');
  cpSync(DATA_DIR, dir, { recursive: true });
  return dir;
};
const rows = (path: string, sql: string) => {
  const db = new Database(path, { readonly: true });
  try {
    return db.query(sql).all();
  } finally {
    db.close();
  }
};
const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8'));

describe('buildIndex: hts_lines and meta', () => {
  const out = join(tmp(), 'tariff.sqlite');
  const res = buildIndex(DATA_DIR, out);

  test('stores one row per raw HTS row, per chapter', () => {
    for (const ch of SCOPE_CHAPTERS) {
      const raw = JSON.parse(readFileSync(join(DATA_DIR, 'hts', `ch${ch}.json`), 'utf8')) as unknown[];
      expect(rows(out, `SELECT count(*) AS n FROM hts_lines WHERE chapter = '${ch}'`)).toEqual([{ n: raw.length }]);
    }
  });

  test('normalizes codes, keeps heading rows with an empty code, and names the source', () => {
    expect(rows(out, "SELECT code, indent, general, source FROM hts_lines WHERE code = '6109.10.00.12'")).toEqual([
      { code: '6109.10.00.12', indent: 4, general: '', source: `data/hts/ch61.json; ${manifest.edition}` },
    ]);
    const [blank] = rows(out, "SELECT count(*) AS n FROM hts_lines WHERE code = ''") as { n: number }[];
    expect(blank!.n).toBeGreaterThan(0);
  });

  test('writes meta with the edition and row counts', () => {
    const meta = Object.fromEntries((rows(out, 'SELECT key, value FROM meta') as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    expect(meta.edition).toBe(manifest.edition);
    expect(meta.hts_lines).toBe(String(res.htsLines));
    expect(Date.parse(meta.built_at!)).not.toBeNaN();
  });

  test('indexes descriptions in hts_fts', () => {
    const hits = rows(out, `SELECT h.code FROM hts_fts JOIN hts_lines h ON h.seq = hts_fts.rowid WHERE hts_fts MATCH '"singlets"' AND h.code = '6109.10.00.07'`);
    expect(hits).toHaveLength(1);
  });

  test('is deterministic', () => {
    const again = join(tmp(), 'again.sqlite');
    buildIndex(DATA_DIR, again);
    for (const sql of ['SELECT * FROM hts_lines ORDER BY seq', 'SELECT * FROM rulings ORDER BY number', 'SELECT * FROM ruling_codes ORDER BY number, code']) {
      expect(rows(again, sql)).toEqual(rows(out, sql));
    }
  });
});

describe('buildIndex: failures', () => {
  test('a bad input file names the file and leaves the previous index intact', () => {
    const data = copyData();
    const out = join(tmp(), 'tariff.sqlite');
    buildIndex(data, out);
    const before = rows(out, 'SELECT count(*) AS n FROM hts_lines');

    const file = join(data, 'hts', 'ch94.json');
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    delete raw[3].general;
    writeFileSync(file, JSON.stringify(raw));

    expect(() => buildIndex(data, out)).toThrow(/hts\/ch94\.json.*general/);
    expect(rows(out, 'SELECT count(*) AS n FROM hts_lines')).toEqual(before);
    expect(existsSync(`${out}.tmp`)).toBe(false);
  });

  test('fails when SOURCES.md is missing', () => {
    const data = copyData();
    unlinkSync(join(data, 'SOURCES.md'));
    expect(() => buildIndex(data, join(tmp(), 'x.sqlite'))).toThrow(/SOURCES\.md/);
  });
});
