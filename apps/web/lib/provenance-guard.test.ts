import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSourced, sourced, UnsourcedFigureError } from './provenance-guard';

const fig = { value: '385.02', prov: 'stated', source: 'page 1' };

describe('assertSourced', () => {
  it('accepts money fields that carry prov and a source, at any depth', () => {
    expect(() =>
      assertSourced({ totalAmount: fig, lines: [{ dutyStated: fig, stated: fig, computed: { ...fig, prov: 'computed' }, difference: null }] }),
    ).not.toThrow();
  });

  it.each([
    ['a money field with no prov', { lines: [{ lineDuty: { value: '385.02', source: 'page 1' } }] }, 'lines[0].lineDuty'],
    ['a money field with an empty source', { mpfFee: { value: '44.50', prov: 'stated', source: '' } }, 'mpfFee'],
    ['a figure field with an unknown prov', { atStake: { value: '750.82', prov: 'model', source: 'x' } }, 'atStake'],
    ['a difference with no prov', { assessment: { lines: [{ difference: { value: '57.96' } }] } }, 'assessment.lines[0].difference'],
  ])('rejects %s', (_, payload, path) => {
    expect(() => assertSourced(payload)).toThrow(UnsourcedFigureError);
    expect(() => assertSourced(payload)).toThrow(path);
  });

  it('ignores non-money objects that happen to have a value', () => {
    expect(() => assertSourced({ description: { value: 'Cotton towels' }, status: { kind: 'haunted' } })).not.toThrow();
  });
});

describe('sourced route wrapper', () => {
  afterEach(() => vi.unstubAllEnvs());
  const bad = sourced(async (_: Request) => Response.json({ grandTotal: { value: '1.00' } }));

  it('passes a sourced payload through untouched', async () => {
    const res = await sourced(async (_: Request) => Response.json({ grandTotal: fig }, { status: 201 }))(new Request('http://x'));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ grandTotal: fig });
  });

  it('returns 500 naming the field in test mode', async () => {
    const res = await bad(new Request('http://x'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'unsourced_figure', path: 'grandTotal' });
  });

  it('returns a safe 500 with no figure or path in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await bad(new Request('http://x'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
  });

  it('leaves non-JSON responses alone', async () => {
    const res = await sourced(async (_: Request) => new Response(null, { status: 303, headers: { location: '/' } }))(new Request('http://x'));
    expect(res.status).toBe(303);
  });
});
