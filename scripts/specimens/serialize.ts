const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v === null || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, sortKeys(o[k])]),
  );
};

/** Stable JSON: keys sorted at every depth, two-space indent, trailing newline. */
export const serialize = (v: unknown): string => `${JSON.stringify(sortKeys(v), null, 2)}\n`;
