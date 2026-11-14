import { describe, expect, it } from 'vitest';
import { parseRateText } from './rate-text';

describe('parseRateText: free', () => {
  it.each(['Free', 'free ', ' FREE'])('%j is free and keeps raw', (raw) => {
    expect(parseRateText(raw)).toEqual({ kind: 'free', raw });
  });
});

describe('parseRateText: ad valorem', () => {
  it.each([
    ['6.5%', '6.5'],
    ['0%', '0'],
    ['12%', '12'],
    // trailing space: 4 lines of the HTS data carry "37.5% " verbatim
    ['37.5% ', '37.5'],
  ])('%j is ad valorem %s percent and keeps raw', (raw, percent) => {
    const r = parseRateText(raw);
    expect(r.kind).toBe('ad_valorem');
    if (r.kind !== 'ad_valorem') return;
    expect(r.raw).toBe(raw);
    expect(r.percent.toString()).toBe(percent);
  });
});

/** Specific rates as plain data, for toEqual. */
function plain(r: ReturnType<typeof parseRateText>): unknown {
  return JSON.parse(JSON.stringify(r));
}

describe('parseRateText: specific', () => {
  it.each([
    ['2.4¢/kg', '2.4', 'cents', 'kg'],
    ['$1.20/doz', '1.2', 'dollars', 'doz'],
    // real HTS texts
    ['39.7¢/kg', '39.7', 'cents', 'kg'],
    ['24¢ each', '24', 'cents', 'each'],
    ['3.3¢/lin. m', '3.3', 'cents', 'lin. m'],
  ])('%j is %s %s per %s', (raw, amount, currencyUnit, per) => {
    expect(plain(parseRateText(raw))).toEqual({ kind: 'specific', amount, currencyUnit, per, raw });
  });
});

describe('parseRateText: compound', () => {
  it.each([
    ['2.4¢/kg + 5%', ['2.4', 'cents', 'kg', '2.4¢/kg'], ['5', '5%']],
    // 4202.32.10.00 general column, verbatim
    ['12.1¢/kg + 4.6%', ['12.1', 'cents', 'kg', '12.1¢/kg'], ['4.6', '4.6%']],
    ['$1.58/pr. + 66%', ['1.58', 'dollars', 'pr.', '$1.58/pr.'], ['66', '66%']],
    ['16¢ each + 45%', ['16', 'cents', 'each', '16¢ each'], ['45', '45%']],
    ['10¢/pack + 20%', ['10', 'cents', 'pack', '10¢/pack'], ['20', '20%']],
    // irregular spacing exactly as it appears in the data
    ['26.5¢/kg +65%', ['26.5', 'cents', 'kg', '26.5¢/kg'], ['65', '65%']],
    ['2.2¢/kg  +  33.5%', ['2.2', 'cents', 'kg', '2.2¢/kg'], ['33.5', '33.5%']],
  ] as const)('%j is specific + ad valorem', (raw, [amount, currencyUnit, per, sRaw], [percent, aRaw]) => {
    expect(plain(parseRateText(raw))).toEqual({
      kind: 'compound',
      parts: [
        { kind: 'specific', amount, currencyUnit, per, raw: sRaw },
        { kind: 'ad_valorem', percent, raw: aRaw },
      ],
      raw,
    });
  });
});
