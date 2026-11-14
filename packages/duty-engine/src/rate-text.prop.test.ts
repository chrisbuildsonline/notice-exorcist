import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseRateText } from './rate-text';

// An independent statement of the supported grammar, written apart from rate-text.ts.
const NUM = String.raw`\d+(?:\.\d+)?`;
const SPEC = String.raw`(?:${NUM}[¢c]|\$${NUM})(?:/(?:kg|doz|pr\.|pack|lin\. m)| each)`;
const GRAMMAR = new RegExp(String.raw`^\s*(?:[Ff][Rr][Ee][Ee]|${NUM}%|${SPEC}|${SPEC}\s*\+\s*${NUM}%)\s*$`);

const num = fc
  .tuple(fc.nat({ max: 100000 }), fc.option(fc.stringMatching(/^\d{1,4}$/), { nil: undefined }))
  .map(([i, f]) => (f === undefined ? String(i) : `${i}.${f}`));
const ws = fc.constantFrom('', ' ', '  ', '\t');
const per = fc.constantFrom('/kg', '/doz', '/pr.', '/pack', '/lin. m', ' each');
const money = fc.oneof(
  num.map((n) => ({ text: `${n}¢`, n, currencyUnit: 'cents' as const })),
  num.map((n) => ({ text: `$${n}`, n, currencyUnit: 'dollars' as const })),
);

describe('parseRateText properties', () => {
  it('(a) supported strings parse to the generated values and keep raw exactly', () => {
    fc.assert(
      fc.property(ws, ws, num, (lead, trail, n) => {
        const raw = `${lead}${n}%${trail}`;
        const r = parseRateText(raw);
        expect(r.raw).toBe(raw);
        expect(r.kind === 'ad_valorem' && r.percent.equals(n)).toBe(true);
      }),
    );
    fc.assert(
      fc.property(ws, fc.constantFrom('Free', 'free', 'FREE', 'fReE'), ws, (lead, free, trail) => {
        const raw = `${lead}${free}${trail}`;
        expect(parseRateText(raw)).toEqual({ kind: 'free', raw });
      }),
    );
    fc.assert(
      fc.property(money, per, fc.option(fc.tuple(ws, ws, num), { nil: undefined }), (m, p, av) => {
        const spec = `${m.text}${p}`;
        const raw = av === undefined ? spec : `${spec}${av[0]}+${av[1]}${av[2]}%`;
        const r = parseRateText(raw);
        expect(r.raw).toBe(raw);
        const s = r.kind === 'compound' ? r.parts[0] : r;
        expect(r.kind).toBe(av === undefined ? 'specific' : 'compound');
        if (s.kind !== 'specific') return;
        expect(s.amount.equals(m.n)).toBe(true);
        expect(s.currencyUnit).toBe(m.currencyUnit);
        expect(s.per).toBe(p.replace(/^[/ ]/, ''));
        if (r.kind === 'compound' && av !== undefined) expect(r.parts[1].percent.equals(av[2])).toBe(true);
      }),
    );
  });

  it('(b) strings outside the grammar are unsupported with identical raw', () => {
    // Near misses: a valid rate text with one character inserted, deleted or replaced.
    // Whitespace is weighted up: stray spaces are the most common way real rate texts drift.
    const alphabet = fc.oneof(fc.constantFrom(' ', '\t'), fc.constantFrom(...'0123456789.%¢c$/+kgdozpr.acklinmehFREfre,x-'.split('')));
    const valid = fc.oneof(
      num.map((n) => `${n}%`),
      fc.tuple(money, per).map(([m, p]) => `${m.text}${p}`),
      fc.tuple(money, per, num).map(([m, p, n]) => `${m.text}${p} + ${n}%`),
      fc.constant('Free'),
    );
    const edited = fc.tuple(valid, fc.nat(), fc.constantFrom('insert', 'delete', 'replace'), alphabet).map(([v, i, op, ch]) => {
      const at = i % (v.length + 1);
      return op === 'insert' ? v.slice(0, at) + ch + v.slice(at) : v.slice(0, at) + (op === 'replace' ? ch : '') + v.slice(at + 1);
    });
    fc.assert(
      fc.property(fc.oneof(edited, fc.string(), fc.string({ unit: 'grapheme' })), (raw) => {
        fc.pre(!GRAMMAR.test(raw));
        expect(parseRateText(raw)).toEqual({ kind: 'unsupported', raw });
      }),
      { numRuns: 10000 },
    );
  });
});
