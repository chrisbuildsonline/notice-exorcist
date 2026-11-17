import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { extractNotice } from './extract';
import { isStatedLeaf } from './map/toSpecimen';
import { form29ModelReply, stubProvider } from './test/stub-provider';
import { loadTruth, wrapTruthAsModel } from './test/wrap';

/** Fixed seed: a failure prints its seed and path, and the same run replays. */
const SEED = 20261117;
const RUNS = 500;
const params = { seed: SEED, numRuns: RUNS, verbose: true } as const;

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const config = readConfig({});

/** The stub returns the same text on the retry, so the result is about that text alone. */
const extract = (text: string) => extractNotice({ bytes: png }, { config, provider: stubProvider([text]) });

/**
 * Every stated value in the result equals the value at the same path in the parsed reply, except a path
 * the honesty guard lists as cleared, which must be null.
 */
function valuesUntouched(notice: unknown, parsed: unknown, cleared: Set<string>, path = ''): void {
  if (isStatedLeaf(notice)) {
    if (cleared.has(path)) expect(notice.value, path).toBeNull();
    else expect((parsed as { value: unknown }).value, path).toStrictEqual(notice.value);
    return;
  }
  if (Array.isArray(notice)) return notice.forEach((x, i) => valuesUntouched(x, (parsed as unknown[])[i], cleared, `${path}[${i}]`));
  if (notice !== null && typeof notice === 'object') {
    for (const [k, x] of Object.entries(notice)) valuesUntouched(x, (parsed as Record<string, unknown>)[k], cleared, path ? `${path}.${k}` : k);
    return;
  }
  expect(parsed, path).toStrictEqual(notice);
}

async function checkText(text: string) {
  const r = await extract(text);
  if (r.ok) valuesUntouched(r.notice, JSON.parse(text), new Set(r.honesty.filter((h) => h.action === 'cleared').map((h) => h.path)));
  return r;
}

type Mutation = (n: Record<string, any>) => void;

/** Near misses of a valid Form 29 reply. Each must be rejected, never repaired. */
const NEAR_MISSES: Record<string, Mutation> = {
  'numeric money': (n) => (n.lines[0].value.value = 4815),
  'money with a thousands separator': (n) => (n.lines[0].value.value = '4,815.00'),
  'money with one decimal': (n) => (n.fees[0].stated.value = '44.5'),
  'money with a currency symbol': (n) => (n.statedTotals[1].stated.value = '$648.36'),
  'confidence 1.2': (n) => (n.entryNumber.confidence = 1.2),
  'negative confidence': (n) => (n.port.confidence = -0.1),
  'missing key': (n) => delete n.dates.notice,
  'extra key': (n) => (n.totalComputed = { value: '648.36', confidence: 0.9, page: 1 }),
  'extra key on a field': (n) => (n.lines[1].hts.computed = true),
  'wrong kind': (n) => (n.kind = 'form29'),
  'actionType outside the enum': (n) => (n.actionType.value = 'liquidation'),
  'null where a value is required, confidence above 0': (n) => (n.entryNumber = { value: null, confidence: 0.9, page: 1 }),
  'non-null value with confidence 0 where the form requires null': (n) =>
    (n.courier = { name: { value: 'X', confidence: 0, page: 1 }, invoiceNumber: { value: 'Y', confidence: 0, page: 1 }, waybill: { value: 'Z', confidence: 0, page: 1 } }),
  'model-written provenance': (n) => (n.port.prov = { kind: 'computed', source: 'sum' }),
  'page 0': (n) => (n.dates.entry.page = 0),
  'date in US format': (n) => (n.dates.entry.value = '10/08/2026'),
};

describe('fuzz: no throw, no coercion', () => {
  it('the unmutated reply is ok (sanity)', async () => {
    expect((await checkText(JSON.stringify(form29ModelReply()))).ok).toBe(true);
  });

  it('a Form 28 reply with line duties differs from the reply only at the cleared paths', async () => {
    const n = wrapTruthAsModel(loadTruth('specimen-1-form28')) as Record<string, any>;
    await fc.assert(
      fc.asyncProperty(fc.array(fc.option(fc.constantFrom('210.60', '171.75', '0.00')), { minLength: 3, maxLength: 3 }), async (duties) => {
        const reply = structuredClone(n);
        reply.lines.forEach((l: any, i: number) => (l.dutyStated.value = duties[i % duties.length]));
        const r = await checkText(JSON.stringify(reply));
        expect(r.ok && r.honesty.length).toBe(duties.slice(0, reply.lines.length).filter((d) => d !== null).length);
      }),
      { ...params, numRuns: 50 },
    );
  });

  it.each(Object.entries(NEAR_MISSES))('near miss "%s" gives ok: false', async (_name, mutate) => {
    const n = form29ModelReply();
    mutate(n);
    expect(await extract(JSON.stringify(n))).toMatchObject({ ok: false });
  });

  it('arbitrary strings never throw', async () => {
    await fc.assert(fc.asyncProperty(fc.string({ unit: 'binary', maxLength: 300 }), async (s) => void (await checkText(s))), params);
  });

  it('arbitrary JSON never throws, and an ok result has values deeply equal to the reply', async () => {
    await fc.assert(fc.asyncProperty(fc.jsonValue({ maxDepth: 4 }), async (v) => void (await checkText(JSON.stringify(v)))), params);
  });

  it('random near misses at random places are rejected or, when still valid, returned unchanged', async () => {
    const mutations = Object.values(NEAR_MISSES);
    // A random mutation, plus a random leaf whose value is replaced by an arbitrary JSON value.
    const arb = fc.record({
      m: fc.integer({ min: 0, max: mutations.length - 1 }),
      line: fc.integer({ min: 0, max: 3 }),
      key: fc.constantFrom('description', 'hts', 'value', 'quantity', 'unit', 'rateText', 'dutyStated', 'n'),
      replacement: fc.jsonValue({ maxDepth: 1 }),
      confidence: fc.double({ min: -1, max: 2, noNaN: true }),
    });
    await fc.assert(
      fc.asyncProperty(arb, async ({ m, line, key, replacement, confidence }) => {
        const a = form29ModelReply();
        mutations[m]!(a);
        expect((await checkText(JSON.stringify(a))).ok).toBe(false);
        const b = form29ModelReply();
        b.lines[line][key] = { value: replacement, confidence, page: 1 };
        const r = await checkText(JSON.stringify(b));
        if (confidence < 0 || confidence > 1) expect(r.ok).toBe(false);
      }),
      params,
    );
  });
});
