import { Database } from 'bun:sqlite';
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DATA_DIR } from '../config';
import { buildIndex } from './build';

const path = join(mkdtempSync(join(tmpdir(), 'tariff-rulings-')), 'tariff.sqlite');
buildIndex(DATA_DIR, path);
const db = new Database(path, { readonly: true });
afterAll(() => db.close());

const codesOf = (n: string) => (db.query('SELECT code, heading FROM ruling_codes WHERE number = ?1 ORDER BY code').all(n) as { code: string; heading: string }[]);

describe('buildIndex: rulings', () => {
  test('stores every ruling file in the snapshot', () => {
    const files = readdirSync(join(DATA_DIR, 'rulings')).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    expect(db.query('SELECT count(*) AS n FROM rulings').get()).toEqual({ n: files.length });
  });

  test('takes codes from the tariff field only, normalized, with their heading', () => {
    // H305865: tariff field "6109.10.00"; its body also mentions 6107.91.00, which must not be filed.
    const raw = JSON.parse(readFileSync(join(DATA_DIR, 'rulings', 'H305865.json'), 'utf8'));
    expect(raw.text).toContain('6107.91.00');
    expect(codesOf('H305865')).toEqual([{ code: '6109.10.00', heading: '6109' }]);

    // N352158: tariff field "6109.10.0012, 9820.11.12, 9903.01.25".
    expect(codesOf('N352158')).toEqual([
      { code: '6109.10.00.12', heading: '6109' },
      { code: '9820.11.12', heading: '9820' },
      { code: '9903.01.25', heading: '9903' },
    ]);
    expect(db.query("SELECT hts_codes FROM rulings WHERE number = 'N352158'").get()).toEqual({ hts_codes: '6109.10.00.12 9820.11.12 9903.01.25' });
  });

  test('sets url, source and date, and keeps the text and title verbatim', () => {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, 'rulings', 'H305865.json'), 'utf8'));
    const row = db.query("SELECT * FROM rulings WHERE number = 'H305865'").get() as Record<string, string>;
    expect(row.url).toBe('https://rulings.cbp.gov/ruling/H305865');
    expect(row.source).toBe(row.url!);
    expect(row.date).toBe('2021-07-12');
    expect(row.title).toBe(raw.subject);
    expect(row.text).toBe(raw.text);
  });

  test('indexes title and text in rulings_fts', () => {
    const hit = db.query(`SELECT r.number FROM rulings_fts JOIN rulings r ON r.rowid = rulings_fts.rowid WHERE rulings_fts MATCH '"affirmation" AND "N305595"'`).all();
    expect(hit).toContainEqual({ number: 'H305865' });
  });

  test('meta counts the rulings', () => {
    const n = (db.query('SELECT count(*) AS n FROM rulings').get() as { n: number }).n;
    expect(db.query("SELECT value FROM meta WHERE key = 'rulings'").get()).toEqual({ value: String(n) });
  });
});
