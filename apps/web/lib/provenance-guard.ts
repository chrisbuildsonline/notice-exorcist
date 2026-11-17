/** Keys that hold money. A `{ value }` under one of them must name its provenance and source. */
const MONEY_KEY = /(amount|duty|total|fee|difference|stated|computed|atstake)$/i;
const PROVS = new Set(['stated', 'computed', 'tariff']);

export class UnsourcedFigureError extends Error {
  constructor(readonly path: string) {
    super(`unsourced figure at ${path}`);
    this.name = 'UnsourcedFigureError';
  }
}

const isMoney = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v && /^-?\d+(\.\d+)?$/.test(String((v as { value: unknown }).value));

/** Walks a payload and throws on the first money field with no `prov` (stated, computed, tariff) or an empty `source`. */
export function assertSourced(payload: unknown, path = ''): void {
  if (Array.isArray(payload)) return payload.forEach((x, i) => assertSourced(x, `${path}[${i}]`));
  if (!payload || typeof payload !== 'object') return;
  for (const [k, v] of Object.entries(payload)) {
    const p = path ? `${path}.${k}` : k;
    if (MONEY_KEY.test(k) && isMoney(v)) {
      if (!PROVS.has(v.prov as string) || typeof v.source !== 'string' || !v.source) throw new UnsourcedFigureError(p);
    } else assertSourced(v, p);
  }
}

/**
 * Wraps a route handler: a JSON response with an unsourced money figure becomes a 500. In test and
 * development it names the field; in production it is a safe error with no figure or path.
 */
export function sourced<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const res = await handler(...args);
    if (!res.headers.get('content-type')?.includes('application/json')) return res;
    try {
      assertSourced(await res.clone().json());
    } catch (e) {
      if (!(e instanceof UnsourcedFigureError)) throw e;
      console.warn('unsourced_figure');
      const body = process.env.NODE_ENV === 'production' ? { error: 'internal_error' } : { error: 'unsourced_figure', path: e.path };
      return Response.json(body, { status: 500 });
    }
    return res;
  };
}
