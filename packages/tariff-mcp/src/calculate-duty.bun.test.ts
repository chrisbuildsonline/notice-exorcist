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
