import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { call, connect, repoRoot } from './harness.bun.test';

// Expected values come from the committed raw snapshot, never from the code under test.
const DATA = join(repoRoot, 'packages/tariff-data/data');
const raw = (ch: string, htsno: string) =>
  (JSON.parse(readFileSync(join(DATA, 'hts', `ch${ch}.json`), 'utf8')) as { htsno: string; general: string; special: string; other: string }[]).find(
    (r) => r.htsno === htsno,
  )!;
const edition: string = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8')).edition;

let client: Client;
beforeAll(async () => {
  client = await connect();
}, 15_000);
afterAll(() => client?.close());

describe('lookup_tariff: a line with its own rate', () => {
  test('6109.10.00 returns the stored rate text, description, ancestors and tariff provenance, without walking up', async () => {
    const r = await call(client, 'lookup_tariff', { htsCode: '6109.10.00' });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent!;
    const line = raw('61', '6109.10.00');
    expect(s.general).toBe(line.general);
    expect(s.general).toBe('16.5%');
    expect(s.special).toBe(line.special);
    expect(s.other).toBe(line.other);
    expect(s.code).toBe('6109.10.00');
    expect(s.description).toBe('Of cotton');
    expect(s.ancestors).toEqual(['T-shirts, singlets, tank tops and similar garments, knitted or crocheted:']);
    expect(typeof s.units).toBe('string');
    expect(s.prov).toEqual({ kind: 'tariff', source: `data/hts/ch61.json; ${edition}`, hts: '6109.10.00', edition });
    expect(s.walkedUp).toBe(false);
    // same data as text for clients that ignore structured content
    expect(JSON.parse(r.content[0]!.text!)).toEqual(s);
  });

  test('accepts the code without dots', async () => {
    const r = await call(client, 'lookup_tariff', { htsCode: '61091000' });
    expect(r.structuredContent).toMatchObject({ code: '6109.10.00', general: '16.5%' });
  });
});

describe('lookup_tariff: bad codes are tool errors with a status', () => {
  test.each([
    ['6109.20.00', 'not_found', '6109.20.00'],
    ['8703.23.01', 'out_of_scope', '8703.23.01'],
    ['abc', 'invalid_code', 'abc'],
  ])('%s -> %s', async (htsCode, status, code) => {
    const r = await call(client, 'lookup_tariff', { htsCode });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toEqual({ status, code });
  });
});
