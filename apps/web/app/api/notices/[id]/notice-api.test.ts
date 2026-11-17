import { beforeEach, describe, expect, it } from 'vitest';
import { fileNotice, listNotices, seedSpecimens } from '../../../../lib/intake';
import { freshDataDir, specimenBytes } from '../../../../lib/test-env';
import { GET } from './route';

type Fig = { value: string; prov: string; source: string };
type Calc = { formulaId: string; inputs: (Fig & { key: string; label: string })[] };
type Body = {
  id: string;
  status: string;
  kind: string | null;
  failure?: { reason: string; message: string };
  assessment?: {
    status: { kind: string; count?: number };
    atStake: Fig | null;
    lines: { label: string; state: string; stated: Fig | null; computed: Fig | null; difference: Fig | null; calc: Calc | null }[];
    totals: { computedTotal: Fig | null; calc: Calc | null };
  };
};

async function fileAndGet(file: string): Promise<Body> {
  const { id, settled } = fileNotice({ bytes: specimenBytes(file), filename: file, source: 'upload' });
  await settled;
  const res = await GET(new Request(`http://x/api/notices/${id}`), { params: Promise.resolve({ id }) });
  expect(res.status).toBe(200);
  return (await res.json()) as Body;
}

/** Every object with a `value` under a figure key carries a provenance kind and a source. */
function figures(v: unknown, out: Fig[] = []): Fig[] {
  if (Array.isArray(v)) v.forEach((x) => figures(x, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('value' in o && typeof o.value === 'string') out.push(o as Fig);
    else Object.values(o).forEach((x) => figures(x, out));
  }
  return out;
}

describe('GET /api/notices/[id] (fixture mode)', () => {
  beforeEach(() => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
  });

  it('Form 29: the planted wrong duty line disagrees with the engine, the rest verify', async () => {
    const b = await fileAndGet('specimen-2-form29.pdf');
    expect(b.status).toBe('ready');
    expect(b.kind).toBe('cbp_form_29');
    const states = b.assessment!.lines.map((l) => l.state);
    expect(states).toEqual(['disagrees', 'verified', 'verified', 'verified', 'verified']);
    const bad = b.assessment!.lines[0]!;
    expect(bad.stated).toMatchObject({ value: '385.02', prov: 'stated' });
    expect(bad.computed).toMatchObject({ value: '442.98', prov: 'computed' });
    expect(bad.difference).toMatchObject({ value: '57.96', prov: 'computed' });
    expect(b.assessment!.status).toEqual({ kind: 'haunted', count: 1 });
    // engine total of the four line duties and the MPF
    expect(b.assessment!.atStake).toMatchObject({ prov: 'computed', value: '750.82' });
  });

  it('each computed line and the recomputed total carry the engine trail for the drawer', async () => {
    const b = await fileAndGet('specimen-2-form29.pdf');
    const a = b.assessment!;
    const bad = a.lines[0]!;
    expect(bad.calc).toMatchObject({
      formulaId: 'line.ad_valorem',
      formula: 'duty = entered value × rate',
      rate: { text: '9.2%', prov: 'stated' },
      rounding: 'half-up to cents, once',
      result: { value: '442.98', prov: 'computed' },
    });
    expect(bad.calc!.inputs.map((i) => [i.key, i.prov])).toEqual([
      ['enteredValue', 'stated'],
      ['percent', 'stated'],
    ]);
    const mpf = a.lines.find((l) => l.label === 'Merchandise Processing Fee')!;
    expect(mpf.calc).toMatchObject({ formulaId: 'fee.mpf', rate: { prov: 'tariff' } });
    expect(a.totals.calc).toMatchObject({ formulaId: 'total.sum', result: a.totals.computedTotal! });
    // the printed total is a duty total, so it sums the duty lines, each labelled
    expect(a.totals.calc!.inputs.map((i) => i.label)).toEqual(a.lines.filter((l) => l.label.startsWith('Line ')).map((l) => l.label));
  });

  it('a line the engine cannot check has no trail', async () => {
    const b = await fileAndGet('specimen-3-courier.pdf');
    expect(b.assessment!.lines.find((l) => l.label === 'Duty disbursement fee')!.calc).toBeNull();
  });

  it('courier: the planted MPF disagrees (the engine clamps to the minimum), the courier fee is not checked', async () => {
    const b = await fileAndGet('specimen-3-courier.pdf');
    const mpf = b.assessment!.lines.find((l) => l.label === 'Merchandise Processing Fee')!;
    expect(mpf.state).toBe('disagrees');
    expect(mpf.computed?.value).toBe('34.58');
    expect(b.assessment!.lines.find((l) => l.label === 'Duty disbursement fee')!.state).toBe('unsupported');
    expect(b.assessment!.status).toEqual({ kind: 'haunted', count: 1 });
  });

  it('Form 28 states no duty, so there is nothing at stake and nothing haunted', async () => {
    const b = await fileAndGet('specimen-1-form28.pdf');
    expect(b.assessment!.lines).toEqual([]);
    expect(b.assessment!.atStake).toBeNull();
    expect(b.assessment!.status).toEqual({ kind: 'at_peace' });
  });

  it('a file with no recorded reading fails with a plain reason and no figures', async () => {
    const b = await fileAndGet('specimen-1-form28.png');
    expect(b.status).toBe('failed');
    expect(b.failure).toEqual({ reason: 'no_fixture', message: expect.stringMatching(/no recorded reading/i) });
    expect(b.assessment).toBeUndefined();
    expect(figures(b)).toEqual([]);
  });

  it('every figure has a provenance kind and a source', async () => {
    for (const f of ['specimen-2-form29.pdf', 'specimen-3-courier.pdf']) {
      const figs = figures(await fileAndGet(f));
      expect(figs.length).toBeGreaterThan(0);
      for (const fig of figs) {
        expect(['stated', 'computed', 'tariff']).toContain(fig.prov);
        expect(fig.source.length).toBeGreaterThan(0);
      }
    }
  });

  it('the specimen seed files all three specimens and each is read with no model', async () => {
    const filed = seedSpecimens();
    await Promise.all(filed.map((f) => f.settled));
    expect(listNotices().map((n) => [n.source, n.status])).toEqual(Array(3).fill(['specimen', 'ready']));
  });

  it('returns 404 for an unknown id', async () => {
    const res = await GET(new Request('http://x/api/notices/nope'), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });
});
