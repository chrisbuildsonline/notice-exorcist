import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { call, connect, textOf } from './harness.bun.test';

const stated = { kind: 'stated', source: 'calculate_duty input' };

let client: Client;
beforeAll(async () => {
  client = await connect();
}, 15_000);
afterAll(() => client?.close());

const duty = async (args: Record<string, unknown>) => {
  const r = await call(client, 'calculate_duty', args);
  expect(r.isError).toBeFalsy();
  return r.structuredContent!;
};

describe('calculate_duty with htsCode', () => {
  test('6109.10.00.12 walks up to 6109.10.00 (16.5%): $1000.00 is 165.00, with tariff provenance on the rate', async () => {
    // worked by hand: 1000.00 x 16.5 / 100 = 165
    const s = await duty({ htsCode: '6109.10.00.12', enteredValue: '1000.00' });
    expect(s.status).toBe('ok');
    expect(s.unrounded).toBe('165');
    expect(s.rateSource).toEqual({ requestedCode: '6109.10.00.12', rateSourceCode: '6109.10.00', walkedUp: true });
    const d = s.duty as { value: string; prov: { kind: string; inputs: Record<string, { value: string; prov: Record<string, string> }> } };
    expect(d.value).toBe('165.00');
    expect(d.prov.kind).toBe('computed');
    expect(d.prov.inputs.percent!.value).toBe('16.5');
    expect(d.prov.inputs.percent!.prov).toMatchObject({ kind: 'tariff', hts: '6109.10.00' });
    expect(d.prov.inputs.enteredValue!.prov).toEqual(stated);
  });

  test('an unknown code is the same tool error lookup_tariff gives', async () => {
    const viaDuty = await call(client, 'calculate_duty', { htsCode: '6109.20.00', enteredValue: '10' });
    const viaLookup = await call(client, 'lookup_tariff', { htsCode: '6109.20.00' });
    expect(viaDuty.isError).toBe(true);
    expect(viaDuty.structuredContent).toEqual({ status: 'not_found', code: '6109.20.00' });
    expect(viaDuty).toEqual(viaLookup);
  });

  test('a real in-scope code whose General text the engine cannot parse is unsupported, with no duty', async () => {
    // 6103.22.00 (men's ensembles, of cotton): General is "The rate applicable to each garment in the ensemble if
    // separately entered". Found with `bun run rates:sweep` (general column, unsupported shapes).
    const s = await duty({ htsCode: '6103.22.00', enteredValue: '500.00' });
    expect(s.status).toBe('unsupported');
    expect(s.raw).toBe('The rate applicable to each garment in the ensemble if separately entered');
    expect(s.reason).toBe('rate_not_supported');
    expect('duty' in s).toBe(false);
    expect('unrounded' in s).toBe(false);
  });
});

describe('calculate_duty: unsupported results', () => {
  test('a specific rate with no quantity is unsupported: missing_quantity', async () => {
    const s = await duty({ enteredValue: '100', rateText: '2.4¢/kg' });
    expect(s).toEqual({ status: 'unsupported', raw: '2.4¢/kg', reason: 'missing_quantity' });
  });

  test('a quantity in another unit is unsupported: unit_mismatch (no conversion)', async () => {
    const s = await duty({ enteredValue: '100', rateText: '2.4¢/kg', quantity: { value: '10', unit: 'doz' } });
    expect(s).toEqual({ status: 'unsupported', raw: '2.4¢/kg', reason: 'unit_mismatch' });
  });

  test('a specific rate with a matching quantity computes', async () => {
    // worked by hand: 10 kg x 2.4¢ = 24¢ = 0.24
    const s = await duty({ enteredValue: '100', rateText: '2.4¢/kg', quantity: { value: '10', unit: 'kg' } });
    expect(s).toMatchObject({ status: 'ok', formulaId: 'line.specific', unrounded: '0.24' });
    expect((s.duty as { value: string }).value).toBe('0.24');
  });

  test('rate text the parser does not support is unsupported with raw and no duty key', async () => {
    const s = await duty({ enteredValue: '100', rateText: 'See 9903.88.03' });
    expect(s).toEqual({ status: 'unsupported', raw: 'See 9903.88.03', reason: 'rate_not_supported' });
    expect('duty' in s).toBe(false);
  });
});

describe('calculate_duty with rateText', () => {
  test('$996.92 at 6.5% is 64.80, rounded once from 64.7998, with the full provenance tree', async () => {
    // worked by hand: 996.92 x 6.5 / 100 = 64.7998 -> half-up to cents = 64.80
    const s = await duty({ enteredValue: '996.92', rateText: '6.5%' });
    expect(s.status).toBe('ok');
    expect(s.unrounded).toBe('64.7998');
    expect(s.formulaId).toBe('line.ad_valorem');
    expect(s.rate).toEqual({ kind: 'ad_valorem', raw: '6.5%', percent: '6.5' });
    expect(s.duty).toEqual({
      value: '64.80',
      prov: {
        kind: 'computed',
        formulaId: 'line.ad_valorem',
        rounding: 'half-up-cents-once',
        rateText: '6.5%',
        inputs: {
          enteredValue: { value: '996.92', prov: stated },
          percent: { value: '6.5', prov: stated },
        },
      },
    });
  });

  test('Free is 0.00', async () => {
    const s = await duty({ enteredValue: '1234.56', rateText: 'Free' });
    expect(s).toMatchObject({ status: 'ok', formulaId: 'line.free', unrounded: '0' });
    expect((s.duty as { value: string }).value).toBe('0.00');
  });

  test('enteredValue as a JS number is a tool error naming the field', async () => {
    const r = await call(client, 'calculate_duty', { enteredValue: 996.92, rateText: '6.5%' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('enteredValue');
  });

  test('a quantity value as a JS number is a tool error', async () => {
    const r = await call(client, 'calculate_duty', { enteredValue: '10', rateText: '2.4¢/kg', quantity: { value: 5, unit: 'kg' } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('quantity');
  });

  test('both or neither of htsCode and rateText is a tool error', async () => {
    for (const args of [{ enteredValue: '10', htsCode: '6109.10.00', rateText: '6.5%' }, { enteredValue: '10' }]) {
      const r = await call(client, 'calculate_duty', args);
      expect(r.isError).toBe(true);
      expect(textOf(r)).toContain('exactly one of htsCode, rateText');
    }
  });
});
