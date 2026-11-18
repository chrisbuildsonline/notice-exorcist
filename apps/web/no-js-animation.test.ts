import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = import.meta.dirname;
const SKIP = new Set(['node_modules', '.next']);
const HOOK = join('components', 'useReducedMotion.ts');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** R3.6: animation driven from JS skips the CSS media query, so it may only live behind the reduced-motion hook. */
function jsAnimation(code: string): string[] {
  const hits: string[] = [];
  for (const m of code.matchAll(/requestAnimationFrame|\.animate\(|behavior:\s*["']smooth["']/g)) hits.push(m[0]);
  return hits;
}

describe('no JS animation', () => {
  it('flags rAF, Web Animations and smooth scrolling, not plain code', () => {
    expect(jsAnimation('requestAnimationFrame(tick)')).toEqual(['requestAnimationFrame']);
    expect(jsAnimation("el.animate([{ opacity: 0 }], 200)")).toEqual(['.animate(']);
    expect(jsAnimation("el.scrollIntoView({ behavior: 'smooth' })")).toEqual(["behavior: 'smooth'"]);
    expect(jsAnimation("el.scrollIntoView({ behavior: 'auto' }); const animated = true;")).toEqual([]);
  });

  it('apps/web sources have none outside useReducedMotion.ts', () => {
    const files = sources(WEB).filter((f) => relative(WEB, f) !== HOOK);
    expect(files.length).toBeGreaterThan(10);
    const hits = files.flatMap((f) => jsAnimation(readFileSync(f, 'utf8')).map((h) => `${relative(WEB, f)}: ${h}`));
    expect(hits).toEqual([]);
  });

  it('the hook reads the reduced-motion media query', () => {
    const hook = join(WEB, HOOK);
    expect(existsSync(hook)).toBe(true);
    expect(readFileSync(hook, 'utf8')).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });
});
