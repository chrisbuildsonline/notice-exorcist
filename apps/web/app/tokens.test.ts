import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const designMd = readFileSync(new URL('../../../design/DESIGN.md', import.meta.url), 'utf8');
const globalsCss = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.replace(/\s+/g, '').toLowerCase());
  }
  return out;
}

const dropIn = designMd.split('### 2.4')[1]?.split('```css')[1]?.split('```')[0] ?? '';
const designTokens = declarations(dropIn);
const appTokens = declarations(globalsCss);

describe('design tokens', () => {
  it('reads the drop-in token block from DESIGN.md', () => {
    expect(designTokens.size).toBeGreaterThan(30);
  });

  it('uses the DESIGN.md canvas colour', () => {
    expect(appTokens.get('--color-canvas')).toBe('#eef0f4');
  });

  it.each(['haunt', 'unverified', 'calm', 'confirm', 'unsupported'])('carries every %s status token', (status) => {
    const names = [...designTokens.keys()].filter((n) => n.startsWith(`--color-${status}-`) || n === `--glow-${status}`);
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const name of names) expect([name, appTokens.get(name)]).toEqual([name, designTokens.get(name)]);
  });

  it('matches every token in DESIGN.md 2.4', () => {
    for (const [name, value] of designTokens) expect([name, appTokens.get(name)]).toEqual([name, value]);
  });
});
