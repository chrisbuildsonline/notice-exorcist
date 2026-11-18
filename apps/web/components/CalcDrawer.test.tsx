import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Calc } from '../lib/calc';
import { CalcDrawer } from './CalcDrawer';

/** Visible text: a Figure's hover tooltip and click popover (hidden until asked for) are left out. */
const text = (html: string) =>
  html
    .replace(/<span[^>]*role="tooltip"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<span[^>]*popover="auto"[^>]*>.*?<br\/>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const calc: Calc = {
  formulaId: 'line.ad_valorem',
  formula: 'duty = entered value × rate',
  substitution: [
    { t: 'input', key: 'enteredValue' },
    { t: 'text', s: ' × ' },
    { t: 'input', key: 'percent' },
  ],
  rate: { text: '9.2%', prov: 'stated', source: 'page 1, box 33' },
  rounding: 'half-up to cents, once',
  inputs: [
    { key: 'enteredValue', label: 'Entered value', kind: 'money', value: '4815', prov: 'stated', source: 'page 1, box 32' },
    { key: 'percent', label: 'Rate', kind: 'rate', value: '9.2', text: '9.2%', prov: 'stated', source: 'page 1, box 33' },
  ],
  result: { value: '442.98', prov: 'computed', source: 'duty-engine line.ad_valorem at 9.2%' },
};

const stated = { value: '385.02', prov: 'stated' as const, source: 'page 1, box 34' };
const difference = { value: '57.96', prov: 'computed' as const, source: 'duty-engine compare.difference' };
const hts = { code: '6302.91.00', rate: '9.1%', edition: '2026 Basic Edition' };

describe('CalcDrawer', () => {
  it('renders a trigger and a closed modal dialog named by its title', () => {
    const html = renderToStaticMarkup(<CalcDrawer title="How line 1 was computed" calc={calc} stated={stated} difference={difference} />);
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>See the math/);
    const dialog = /<dialog([^>]*)>/.exec(html)?.[1] ?? '';
    expect(dialog).not.toMatch(/\sopen(=|\s|$)/);
    const labelledby = /aria-labelledby="([^"]+)"/.exec(dialog)?.[1];
    expect(html).toContain(`id="${labelledby}"`);
    expect(text(html)).toContain('How line 1 was computed');
  });

  it('shows the formula with the inputs in place, the rounding rule and the engine caption', () => {
    const t = text(renderToStaticMarkup(<CalcDrawer title="How line 1 was computed" calc={calc} stated={stated} difference={difference} />));
    expect(t).toContain('duty = entered value × rate');
    expect(t).toContain('= $4,815.00 stated × 9.2% stated');
    expect(t).toContain('= $442.98 computed');
    expect(t).toContain('rounding: half-up to cents, once');
    expect(t).toContain('Computed by duty-engine, not by the AI model.');
  });

  it('quotes the rate text with its source, and the HTS edition the tariff gives for the printed code', () => {
    const html = renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={stated} difference={difference} hts={hts} />);
    const t = text(html);
    expect(t).toMatch(/Rate text “9\.2%” stated · page 1, box 33/);
    expect(t).toMatch(/HTS 6302\.91\.00 · tariff rate “9\.1%” · 2026 Basic Edition/);
    expect(html).toMatch(/<a[^>]*href="https:\/\/hts\.usitc\.gov[^"]*"/);
  });

  it('says when the tariff index cannot give the HTS edition', () => {
    const t = text(renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={stated} difference={difference} hts="not-built" />));
    expect(t).toContain('No HTS edition: the tariff index is not built on this server');
    const f = text(renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={stated} difference={difference} hts="not-found" />));
    expect(f).toContain('No HTS edition: the printed code is not in the tariff index');
  });

  it('lists every input with its provenance and source', () => {
    const html = renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={stated} difference={difference} />);
    const rows = [...html.matchAll(/<li data-testid="calc-input"[^>]*>(.*?)<\/li>/g)].map((m) => text(m[1]!));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/^Entered value .*\$4,815\.00 stated.* page 1, box 32$/);
    expect(rows[1]).toMatch(/^Rate .*9\.2% stated.* page 1, box 33$/);
  });

  it('puts the notice figure beside the recomputed one with a Mismatch pill and the difference', () => {
    const t = text(renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={stated} difference={difference} />));
    expect(t).toMatch(/! Mismatch/);
    expect(t).toMatch(/Notice says \$385\.02 stated .*Recomputed \$442\.98 computed/);
    expect(t).toMatch(/Difference \$57\.96 computed/);
  });

  it('shows Match when the notice agrees, and no comparison when the notice states nothing', () => {
    expect(text(renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={{ ...stated, value: '442.98' }} difference={null} />))).toMatch(/✓ Match/);
    const none = text(renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={null} difference={null} />));
    expect(none).not.toMatch(/Match|Mismatch/);
  });

  it('has no primary pill: it is a reading surface', () => {
    const html = renderToStaticMarkup(<CalcDrawer title="t" calc={calc} stated={stated} difference={difference} />);
    expect(html).not.toContain('bg-ink');
  });
});

describe('CalcDrawer for a line the engine cannot check (R5.8)', () => {
  const unsupported = { rateText: '2.4¢/kg + 5% (see note)', reason: 'unsupported rate text' };
  const html = renderToStaticMarkup(<CalcDrawer title="How line 3 was checked" unsupported={unsupported} stated={stated} difference={null} hts={hts} />);
  const t = text(html);

  it('shows the rate text verbatim, the HTS edition, the reason and the engine caption', () => {
    expect(t).toContain('Rate text “2.4¢/kg + 5% (see note)”');
    expect(t).toMatch(/HTS 6302\.91\.00 · tariff rate “9\.1%” · 2026 Basic Edition/);
    expect(html).toMatch(/data-testid="unsupported-why"[^>]*>.*unsupported rate text/);
    expect(t).toContain('Computed by duty-engine, not by the AI model.');
  });

  it('has no formula, no result, no Match or Mismatch, and only the stated figure as money', () => {
    expect(html).not.toContain('data-testid="formula"');
    expect(html).not.toContain('data-testid="calc-input"');
    expect(t).not.toMatch(/Match|Mismatch|rounding/);
    expect(t).toMatch(/Notice says \$385\.02 stated .*Recomputed — Not computed/);
    expect(t.match(/\$/g)).toHaveLength(1);
  });

  it('keeps the dialog wiring: a See the math trigger and a closed modal named by its title', () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>See the math/);
    expect(t).toContain('How line 3 was checked');
  });
});
