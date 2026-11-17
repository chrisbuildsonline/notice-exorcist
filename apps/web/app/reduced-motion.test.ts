import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of `@media (prefers-reduced-motion: reduce) { … }`, braces balanced. */
function reducedMotionBlock(): string {
  const start = css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/);
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
  }
  throw new Error('unbalanced media block');
}

const rule = (block: string, selector: string) => {
  const m = new RegExp(`${selector.replace(/[.*[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(block);
  return m?.[1] ?? '';
};

describe('reduced motion', () => {
  const block = reducedMotionBlock();

  it('turns every animation off and makes transitions instant', () => {
    const all = rule(block, '*, *::before, *::after');
    expect(all).toMatch(/animation\s*:\s*none\s*!important/);
    expect(all).toMatch(/transition-duration\s*:\s*0ms\s*!important/);
  });

  it.each([
    ['.glow-unverified', /0 0 0 1px var\(--color-unverified-edge\),\s*0 0 12px var\(--glow-unverified\)/],
    ['.glow-haunt', /0 0 0 2px var\(--color-haunt-edge\),\s*0 0 20px var\(--glow-haunt\)/],
  ])('%s keeps a static glow (DESIGN.md 3)', (selector, shadow) => {
    expect(rule(block, selector)).toMatch(/box-shadow\s*:/);
    expect(rule(block, selector)).toMatch(shadow);
  });
});
