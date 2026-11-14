import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from '../build/build';
import { DATA_DIR } from '../config';
import { IndexNotBuiltError, lookupHts, openIndex } from './index';

const path = join(mkdtempSync(join(tmpdir(), 'tariff-lookup-')), 'tariff.sqlite');
buildIndex(DATA_DIR, path);
const db = openIndex(path);
afterAll(() => db.close());

const raw = (ch: string, htsno: string) =>
  (JSON.parse(readFileSync(join(DATA_DIR, 'hts', `ch${ch}.json`), 'utf8')) as { htsno: string; general: string }[]).find((r) => r.htsno === htsno)!;
const edition = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8')).edition;

describe('lookupHts', () => {
  test('6109.10.00 returns the general text from the snapshot, with provenance', () => {
    const r = lookupHts(db, '6109.10.00');
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.general).toBe(raw('61', '6109.10.00').general);
    expect(r.general).toBe('16.5%');
    expect(r.description).toBe('Of cotton');
    expect(r.ancestors).toEqual(['T-shirts, singlets, tank tops and similar garments, knitted or crocheted:']);
    expect(r.prov).toEqual({ kind: 'tariff', source: `data/hts/ch61.json; ${edition}`, hts: '6109.10.00', edition });
  });

  test('accepts the code with or without dots', () => {
    for (const c of ['6109100012', '6109.10.00.12', '6109.10.0012']) {
      expect(lookupHts(db, c)).toMatchObject({ status: 'ok', code: '6109.10.00.12' });
    }
  });

  test('a statistical line with an empty general returns the empty string, not the parent rate', () => {
    const r = lookupHts(db, '6109.10.00.12');
    if (r.status !== 'ok') throw new Error(r.status);
    expect(r.general).toBe('');
    expect(r.ancestors.at(-1)).toBe('T-shirts, singlets, tank tops and similar garments, knitted or crocheted:');
    expect(r.ancestors).toContain('Of cotton');
    expect(r.ancestors).toContain("Men's or boys':");
    expect(r.units).toBe(JSON.stringify(['doz.', 'kg']));
  });

  test('returns rate text verbatim, including compound rates', () => {
    const r = lookupHts(db, '4202.32.10.00');
    expect(r).toMatchObject({ status: 'ok', general: raw('42', '4202.32.10.00').general });
  });

  test('a code that is not a line in the schedule is not_found', () => {
    expect(lookupHts(db, '6109.10')).toEqual({ status: 'not_found', code: '6109.10' });
    expect(lookupHts(db, '6109.20.00')).toEqual({ status: 'not_found', code: '6109.20.00' });
  });

  test('a chapter outside the scope is out_of_scope', () => {
    expect(lookupHts(db, '8703.23.01')).toEqual({ status: 'out_of_scope', code: '8703.23.01' });
    expect(lookupHts(db, '9903.88.15')).toEqual({ status: 'out_of_scope', code: '9903.88.15' });
  });

  test('malformed codes are invalid_code', () => {
    for (const c of ['abc', '', '61091', "6109' OR 1=1 --"]) {
      expect(lookupHts(db, c)).toEqual({ status: 'invalid_code', code: c });
    }
  });
});

describe('openIndex', () => {
  test('throws IndexNotBuiltError when the file is missing', () => {
    expect(() => openIndex(join(tmpdir(), 'no-such-index.sqlite'))).toThrow(IndexNotBuiltError);
  });
});
