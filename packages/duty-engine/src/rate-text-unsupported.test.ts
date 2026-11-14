import { describe, expect, it } from 'vitest';
import { parseRateText } from './rate-text';

describe('parseRateText: unsupported', () => {
  it.each([
    'See 9903.88.03',
    '',
    '   ',
    '3.4% + 0.5¢/kg, max 8%',
    'Free except as provided',
    // real HTS texts that must never be guessed at
    'The rate applicable to each garment in the ensemble if separately entered',
    '33 1/3%',
    '86.1¢/m2 of recording surface',
    '86.1¢/m2of recording surface',
    'Free (A,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)',
    // near misses of the supported forms
    '5% + 2.4¢/kg',
    '2.4¢/kg + 5% + 1¢/kg',
    '6.5 %',
    '-5%',
    '.5%',
    '2.4¢/lb',
    '$/kg',
    '2.4¢/kg + ',
  ])('%j is unsupported with raw unchanged and no other field', (raw) => {
    const r = parseRateText(raw);
    expect(r).toEqual({ kind: 'unsupported', raw });
    expect(Object.keys(r).sort()).toEqual(['kind', 'raw']);
    expect(r.raw).toBe(raw);
  });
});
