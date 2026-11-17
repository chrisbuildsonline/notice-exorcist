import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { call, connect } from './harness.bun.test';

const prov = { kind: 'stated', source: 'explain_rate input' };

let client: Client;
beforeAll(async () => {
  client = await connect();
}, 15_000);
afterAll(() => client?.close());

const explain = async (rateText: string) => {
  const r = await call(client, 'explain_rate', { rateText });
  expect(r.isError).toBeFalsy();
  return r.structuredContent!;
};

describe('explain_rate', () => {
  test.each([
    ['Free', { kind: 'free', raw: 'Free', prov }],
    ['6.5%', { kind: 'ad_valorem', raw: '6.5%', percent: '6.5', prov }],
    ['2.4¢/kg', { kind: 'specific', raw: '2.4¢/kg', amount: '2.4', currencyUnit: 'cents', per: 'kg', prov }],
    ['$1.20/doz', { kind: 'specific', raw: '$1.20/doz', amount: '1.2', currencyUnit: 'dollars', per: 'doz', prov }],
    [
      '2.4¢/kg + 5%',
      {
        kind: 'compound',
        raw: '2.4¢/kg + 5%',
        parts: [
          { kind: 'specific', raw: '2.4¢/kg', amount: '2.4', currencyUnit: 'cents', per: 'kg' },
          { kind: 'ad_valorem', raw: '5%', percent: '5' },
        ],
        prov,
      },
    ],
    ['See 9903.88.03', { kind: 'unsupported', raw: 'See 9903.88.03', prov }],
  ])('%s', async (rateText, expected) => {
    const s = await explain(rateText);
    expect(s).toEqual(expected);
    expect(s.raw).toBe(rateText);
  });

  test('percent and amount are strings, never JS numbers', async () => {
    const s = await explain('2.4¢/kg + 5%');
    const [sp, av] = s.parts as Record<string, unknown>[];
    expect(typeof sp!.amount).toBe('string');
    expect(typeof av!.percent).toBe('string');
    expect(typeof (await explain('6.5%')).percent).toBe('string');
  });

  test('keeps raw text verbatim, including surrounding spaces', async () => {
    const s = await explain('  16.5% ');
    expect(s).toEqual({ kind: 'ad_valorem', raw: '  16.5% ', percent: '16.5', prov });
  });
});
