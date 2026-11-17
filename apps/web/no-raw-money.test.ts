import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = import.meta.dirname;
const SKIP = new Set(['node_modules', '.next']);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Money is drawn by Figure alone: `toFixed(2)` or a currency `Intl.NumberFormat` anywhere else is a raw figure. */
function rawMoney(code: string): string[] {
  const hits: string[] = [];
  if (/\.toFixed\(\s*2\s*\)/.test(code)) hits.push('toFixed(2)');
  for (const m of code.matchAll(/Intl\.NumberFormat\([^)]*\)/gs)) if (/currency/.test(m[0])) hits.push('Intl.NumberFormat currency');
  return hits;
}

describe('no raw money outside Figure', () => {
  it('flags toFixed(2) and a currency NumberFormat, not other formatting', () => {
    expect(rawMoney('const s = `$${n.toFixed(2)}`')).toEqual(['toFixed(2)']);
    expect(rawMoney("new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)")).toEqual(['Intl.NumberFormat currency']);
    expect(rawMoney("new Intl.NumberFormat('en-US').format(n); n.toFixed(1)")).toEqual([]);
  });

  it('apps/web sources format money only in components/Figure.tsx', () => {
    const files = sources(WEB);
    expect(files.length).toBeGreaterThan(10);
    const hits = files
      .filter((f) => relative(WEB, f) !== join('components', 'Figure.tsx'))
      .flatMap((f) => rawMoney(readFileSync(f, 'utf8')).map((h) => `${relative(WEB, f)}: ${h}`));
    expect(hits).toEqual([]);
  });
});
