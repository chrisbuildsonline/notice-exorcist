import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LineState } from '../lib/states';
import { GLOW, HauntedLine } from './HauntedLine';

const STATES: Array<[LineState, string, string]> = [
  ['disagrees', '!', 'Disagrees'],
  ['unverified', '?', 'Unverified'],
  ['verified', '✓', 'Verified'],
  ['confirm', '◐', 'Confirm'],
  ['unsupported', '⊘', 'Not checked'],
];

const stated = { value: '385.02', prov: 'stated' as const, source: 'page 1' };
const computed = { value: '442.98', prov: 'computed' as const, source: 'duty-engine line.adValorem at 9.2%' };
const render = (state: LineState) => renderToStaticMarkup(<HauntedLine state={state} label="Line 1 · Towels" stated={stated} computed={computed} />);
const classes = (html: string) => /class="([^"]*)"/.exec(html)![1]!.split(/\s+/);

describe('HauntedLine', () => {
  it.each(STATES)('%s shows the word and the icon, not colour alone', (state, icon, word) => {
    const html = render(state);
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain(`>${icon}<`);
    expect(html).toContain(word);
  });

  it('only disagrees and unverified glow', () => {
    for (const [state] of STATES) {
      const glows = classes(render(state)).filter((c) => c.startsWith('glow-'));
      expect(glows, state).toEqual(state === 'disagrees' || state === 'unverified' ? [GLOW[state]] : []);
    }
    expect(GLOW.disagrees).not.toBe(GLOW.unverified);
  });

  it('no glow class uses the accent, in its name or its CSS', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'app', 'globals.css'), 'utf8');
    for (const cls of Object.values(GLOW)) {
      expect(cls).not.toMatch(/accent/);
      const rules = [...css.matchAll(new RegExp(`\\.${cls}[^{]*\\{[^}]*\\}`, 'g'))].map((m) => m[0]);
      expect(rules.length, cls).toBeGreaterThan(0);
      for (const r of rules) expect(r).not.toMatch(/accent|91,\s*61,\s*245|5b3df5/i);
    }
  });

  it('a disagreeing line shows the stated and the computed figure side by side', () => {
    const html = render('disagrees');
    expect(html).toContain('$385.02');
    expect(html).toContain('$442.98');
    expect(html.indexOf('$385.02')).toBeLessThan(html.indexOf('$442.98'));
  });

  it('a verified line shows only the stated figure', () => {
    const html = render('verified');
    expect(html).toContain('$385.02');
    expect(html).not.toContain('$442.98');
  });
});
