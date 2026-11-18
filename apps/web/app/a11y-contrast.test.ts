import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WCAG 2.x contrast of the design/DESIGN.md 2.1 pairs, from the token values in globals.css.
// The documented ratios are read from DESIGN.md, so a wrong ratio is fixed in the doc, not here.
const designMd = readFileSync(new URL('../../../design/DESIGN.md', import.meta.url), 'utf8');
const globalsCss = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

const tokens = new Map<string, string>();
for (const m of globalsCss.matchAll(/--color-([\w-]+)\s*:\s*(#[0-9a-f]{3,6})\s*;/gi)) tokens.set(m[1]!, m[2]!.toLowerCase());

function hex(name: string): string {
  const v = tokens.get(name);
  if (!v) throw new Error(`no --color-${name} in globals.css`);
  return v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v;
}

function luminance(colour: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(colour.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(hex(fg)), luminance(hex(bg))].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

// Rows of the 2.1 tables, keyed by the token name in backticks in the first column.
function row(token: string): string[] {
  const line = designMd.split('\n').find((l) => l.startsWith(`| \`${token}\``) || l.startsWith(`| **\`${token}\`**`));
  if (!line) throw new Error(`no ${token} row in DESIGN.md 2.1`);
  return line.split('|').map((c) => c.trim());
}

function documented(cell: string, pattern: RegExp): number {
  const m = cell.match(pattern);
  if (!m) throw new Error(`no ratio matching ${pattern} in "${cell}"`);
  return Number(m[1]);
}

const contrastCol = (token: string) => row(token)[4]!;
const statusCol = (status: string, col: 'edge' | 'fgOnBg') => row(status)[col === 'edge' ? 5 : 7]!;

type Pair = { name: string; fg: string; bg: string; doc: number; min: number };

const text: Pair[] = [
  { name: 'ink on surface', fg: 'ink', bg: 'surface', doc: documented(contrastCol('ink'), /([\d.]+) on white/), min: 4.5 },
  { name: 'text-secondary on surface', fg: 'text-secondary', bg: 'surface', doc: documented(contrastCol('text-secondary'), /([\d.]+) white/), min: 4.5 },
  { name: 'text-secondary on canvas', fg: 'text-secondary', bg: 'canvas', doc: documented(contrastCol('text-secondary'), /([\d.]+) canvas/), min: 4.5 },
  { name: 'text-muted on surface', fg: 'text-muted', bg: 'surface', doc: documented(contrastCol('text-muted'), /([\d.]+) white/), min: 4.5 },
  { name: 'text-muted on canvas', fg: 'text-muted', bg: 'canvas', doc: documented(contrastCol('text-muted'), /([\d.]+) canvas/), min: 4.5 },
  { name: 'accent on surface', fg: 'accent', bg: 'surface', doc: documented(contrastCol('accent'), /([\d.]+) white/), min: 4.5 },
  { name: 'accent on canvas', fg: 'accent', bg: 'canvas', doc: documented(contrastCol('accent'), /([\d.]+) canvas/), min: 4.5 },
  { name: 'surface on accent', fg: 'surface', bg: 'accent', doc: documented(contrastCol('accent'), /white on accent ([\d.]+)/), min: 4.5 },
];

const statuses = ['haunt', 'unverified', 'calm', 'confirm', 'unsupported'] as const;
const statusFg: Pair[] = statuses.map((s) => ({ name: `${s}-fg on ${s}-bg`, fg: `${s}-fg`, bg: `${s}-bg`, doc: documented(statusCol(s, 'fgOnBg'), /^([\d.]+)$/), min: 4.5 }));
const edges: Pair[] = statuses.map((s) => ({ name: `${s}-edge on surface`, fg: `${s}-edge`, bg: 'surface', doc: documented(statusCol(s, 'edge'), /\(([\d.]+)\)/), min: 3 }));
// The focus ring is the accent outline (DESIGN.md 2.4), a non-text contrast of at least 3:1.
const focusRing: Pair[] = [
  { name: 'focus ring on canvas', fg: 'accent', bg: 'canvas', doc: documented(contrastCol('accent'), /([\d.]+) canvas/), min: 3 },
  { name: 'focus ring on surface', fg: 'accent', bg: 'surface', doc: documented(contrastCol('accent'), /([\d.]+) white/), min: 3 },
];

describe('contrast of the DESIGN.md pairs', () => {
  it('computes the WCAG ratio of black on white as 21', () => {
    tokens.set('test-black', '#000000');
    tokens.set('test-white', '#ffffff');
    expect(contrast('test-black', 'test-white')).toBeCloseTo(21, 5);
  });

  it.each([...text, ...statusFg, ...edges, ...focusRing])('$name is $doc as documented and at least $min', ({ fg, bg, doc, min }) => {
    const ratio = contrast(fg, bg);
    expect(Math.round(ratio * 10) / 10).toBe(doc);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it.each(statuses)('ink on %s-bg is at least 15 as documented', (s) => {
    const floor = documented(designMd, /every tinted row keeps `ink` text \(≥(\d+):1 on any status bg\)/);
    expect(floor).toBe(15);
    expect(contrast('ink', `${s}-bg`)).toBeGreaterThanOrEqual(floor);
  });
});
