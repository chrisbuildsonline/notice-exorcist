// Test-only: reads the committed tariff-data HTS files straight from disk. The engine itself does no I/O.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRateText, type ParsedRate } from './rate-text';

const HTS_DIR = join(import.meta.dirname, '../../tariff-data/data/hts');
type Row = { htsno: string; general: string; special: string; other: string };
const files = readdirSync(HTS_DIR).filter((f) => f.endsWith('.json'));
const rows: Row[] = files.flatMap((f) => JSON.parse(readFileSync(join(HTS_DIR, f), 'utf8')) as Row[]);

const COLUMNS = ['general', 'special', 'other'] as const;
const KINDS: ParsedRate['kind'][] = ['free', 'ad_valorem', 'specific', 'compound', 'unsupported'];

function sweep(column: (typeof COLUMNS)[number]) {
  const counts: Record<string, number> = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const unsupported = new Map<string, number>();
  let empty = 0;
  for (const row of rows) {
    const raw = row[column];
    const r = parseRateText(raw);
    expect(KINDS).toContain(r.kind);
    expect(r.raw).toBe(raw);
    counts[r.kind]!++;
    if (raw.trim() === '') empty++;
    else if (r.kind === 'unsupported') unsupported.set(raw, (unsupported.get(raw) ?? 0) + 1);
  }
  return { counts, empty, unsupported };
}

describe('parser sweep over every HTS rate text in tariff-data', () => {
  it('reads all ten chapter files', () => {
    expect(files.length).toBe(10);
    expect(rows.length).toBeGreaterThan(7000);
  });

  it.each(COLUMNS)('%s column: never throws, every result is parsed or unsupported with raw intact', (column) => {
    const { counts, empty, unsupported } = sweep(column);
    console.log(
      `[sweep] ${column}: ${rows.length} rows, ${empty} empty (unsupported), counts ${JSON.stringify(counts)}, ` +
        `${unsupported.size} distinct non-empty unsupported shapes`,
    );
    if (column !== 'special') {
      for (const [raw, n] of [...unsupported].sort((a, b) => b[1] - a[1])) console.log(`[sweep]   ${column} unsupported x${n}: ${JSON.stringify(raw)}`);
    }
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(rows.length);
  });

  it('leaves exactly the known odd general and column 2 texts unsupported', () => {
    // Anything new here means the data changed: decide on purpose whether the grammar should cover it.
    const odd = new Set([...sweep('general').unsupported.keys(), ...sweep('other').unsupported.keys()]);
    expect([...odd].sort()).toEqual(
      [
        '33 1/3%',
        '86.1¢/m2 of recording surface',
        '86.1¢/m2of recording surface',
        'The rate applicable to each garment in the ensemble if entered separately',
        'The rate applicable to each garment in the ensemble if separately entered',
        'The rate applicable to each garment in the in the ensemble if separately entered',
      ].sort(),
    );
  });

  it('parses 4202.32.10.00 general "12.1¢/kg + 4.6%" as compound', () => {
    const row = rows.find((r) => r.htsno === '4202.32.10.00');
    expect(row?.general).toBe('12.1¢/kg + 4.6%');
    expect(parseRateText(row!.general).kind).toBe('compound');
  });

  it('returns unsupported for 10-digit statistical lines whose rate is empty (callers walk up to the 8-digit parent)', () => {
    const blank = rows.filter((r) => /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/.test(r.htsno) && r.general === '');
    expect(blank.length).toBeGreaterThan(0);
    for (const r of blank) expect(parseRateText(r.general)).toEqual({ kind: 'unsupported', raw: '' });
  });
});
