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
