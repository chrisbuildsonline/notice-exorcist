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

  /** Rules outside the reduced-motion block, as [selectors, body]. Keyframe steps (from/to) are left out. */
  const outside = css.replace(block, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const rules = [...outside.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim().split(/\s*,\s*/), m[2]!] as const);
  const blockRules = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim().split(/\s*,\s*/), m[2]!] as const);
  /** The body of the block rule whose selector list names `selector`. */
  const inBlock = (selector: string) => blockRules.filter(([sels]) => sels.includes(selector)).map(([, body]) => body).join(';');

  it('neutralises every keyframe animation used in globals.css', () => {
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const users = rules.filter(([, body]) => new RegExp(`animation(?:-name)?\\s*:[^;]*\\b${name}\\b`).test(body)).flatMap(([sels]) => sels);
      expect(users.length, `${name} is used`).toBeGreaterThan(0);
      for (const sel of users) {
        // `*, *::before, *::after` reaches elements and those two pseudo-elements only; ::backdrop and the rest need their own rule.
        const pseudo = /::([\w-]+)/.exec(sel)?.[1];
        if (pseudo && pseudo !== 'before' && pseudo !== 'after') expect(inBlock(sel), `${sel} (${name})`).toMatch(/animation\s*:\s*none/);
      }
    }
  });

  it.each(['.fog', '.line', '.calc-panel', '.side-panel'])('%s has no transition and no animation', (selector) => {
    expect(inBlock(selector)).toMatch(/transition\s*:\s*none\s*!important/);
    expect(inBlock(selector)).toMatch(/animation\s*:\s*none\s*!important/);
  });

  it('scrolls without smoothing', () => {
    expect(inBlock('html')).toMatch(/scroll-behavior\s*:\s*auto/);
  });

  it('static glow values are the ones in DESIGN.md 3', () => {
    const design = readFileSync(join(import.meta.dirname, '..', '..', '..', 'design', 'DESIGN.md'), 'utf8');
    for (const [status, edge, glow, cls] of [
      ['unverified', 'unverified-edge', 'glow-unverified', '.glow-unverified'],
      ['disagrees', 'haunt-edge', 'glow-haunt', '.glow-haunt'],
    ] as const) {
      const m = new RegExp(`${status} is \`([^\`]+)\` edge plus \`([^\`]+)\``).exec(design);
      expect(m, status).not.toBeNull();
      const want = `${m![1]} var(--color-${edge}), ${m![2]}`;
      expect(m![2]).toContain(`var(--${glow})`);
      expect(rule(block, cls).replace(/\s+/g, ' ')).toContain(`box-shadow:${want}`.replace(/\s+/g, ' '));
    }
  });

  describe('the haunt layer (DESIGN.md 3.1) stays, still', () => {
    const design = readFileSync(join(import.meta.dirname, '..', '..', '..', 'design', 'DESIGN.md'), 'utf8');
    const section = design.split('### 3.1')[1]?.split('\n## ')[0] ?? '';
    const reduced = section.split('**Reduced motion:**')[1] ?? '';

    it('DESIGN.md 3.1 has a reduced-motion list', () => {
      expect(reduced).toContain('getAnimations()');
    });

    it('the aura is static at its first frame', () => {
      const m = /The aura is static at its first frame \(`([^`]+)`\)/.exec(reduced);
      expect(m).not.toBeNull();
      expect(inBlock('.paper[data-aura=haunt]').replace(/\s+/g, ' ')).toContain(`box-shadow:${m![1]}`.replace(/\s+/g, ' '));
    });

    it('the possessed figure keeps a static afterimage', () => {
      const m = /static afterimage `([^`]+)`/.exec(reduced);
      expect(m).not.toBeNull();
      expect(inBlock('.possessed .num').replace(/\s+/g, ' ')).toContain(`text-shadow:${m![1]}`.replace(/\s+/g, ' '));
    });

    it('the veil and the wisp are hidden, the mist and the figures rest', () => {
      expect(inBlock('.haunt-veil')).toMatch(/display\s*:\s*none/);
      expect(inBlock('.glow-haunt::after')).toMatch(/display\s*:\s*none/);
      expect(inBlock('.haunt-mist')).toMatch(/opacity\s*:\s*1/);
      expect(inBlock('.materialize')).toMatch(/opacity\s*:\s*1/);
      expect(inBlock('.materialize')).toMatch(/filter\s*:\s*none/);
    });

    it('the exorcism is instant: no ring', () => {
      expect(inBlock('.exorcise-ring')).toMatch(/display\s*:\s*none/);
    });
  });

  it.each(['confirm', 'unsupported', 'verified'])('%s has no shadow and no animation anywhere', (state) => {
    for (const [sels, body] of [...rules, ...blockRules]) {
      if (sels.some((s) => s.includes(`data-state=${state}`))) expect(body, sels.join(',')).not.toMatch(/box-shadow|animation/);
    }
  });
});
