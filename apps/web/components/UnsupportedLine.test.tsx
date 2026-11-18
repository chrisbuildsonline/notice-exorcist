import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HauntedLine } from './HauntedLine';
import { RATE_SENTENCE, UnsupportedLine } from './UnsupportedLine';

/** Visible text: a Figure's hover tooltip and click popover (hidden until asked for) are left out. */
const text = (html: string) =>
  html
    .replace(/<span[^>]*role="tooltip"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<span[^>]*popover="auto"[^>]*>.*?<br\/>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const RATE = '2.4¢/kg + 5% (see note)';
const stated = { value: '612', prov: 'stated' as const, source: 'page 1, box 34' };

describe('UnsupportedLine (R5.2, R5.3, R5.5)', () => {
  it('shows a dash for the recomputed and the difference cell, and the plain sentence in the DOM', () => {
    const html = renderToStaticMarkup(<UnsupportedLine rateText={RATE} />);
    expect(RATE_SENTENCE).toBe('Duty-engine cannot check this rate, so the figure is shown as printed on the notice.');
    expect(html).toMatch(/data-testid="recomputed-cell"[^>]*>.*aria-label="Not computed"[^>]*>—</);
    expect(html).toMatch(/data-testid="difference-cell"[^>]*>.*—/);
    expect(text(html)).toContain(RATE_SENTENCE);
    expect(html).not.toMatch(/title=|role="tooltip"/);
  });

  it('draws no figure: no dollar sign and no digit', () => {
    const t = text(renderToStaticMarkup(<UnsupportedLine rateText={RATE} />));
    expect(t).not.toMatch(/\$|\d/);
  });

  it('a charge with no rate text says the engine cannot check that kind of charge', () => {
    const t = text(renderToStaticMarkup(<UnsupportedLine rateText={null} />));
    expect(t).toContain('Duty-engine cannot check this kind of charge, so the figure is shown as printed on the notice.');
  });
});

describe('HauntedLine in state unsupported', () => {
  const zero = { value: '0', prov: 'computed' as const, source: 'duty-engine' };
  const html = renderToStaticMarkup(
    <HauntedLine state="unsupported" label="Line 3 · Mug lids" meta={`6912.00.48 · ${RATE}`} rateText={RATE} stated={stated} computed={zero} />,
  );

  it('keeps the stated figure with its tag, quotes the rate text verbatim in mono and says why', () => {
    const t = text(html);
    expect(t).toMatch(/\$612\.00 stated/);
    expect(html).toMatch(new RegExp(`class="[^"]*font-mono[^"]*">6912\\.00\\.48 · ${RATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`));
    expect(t).toContain(RATE_SENTENCE);
    expect(t).toContain('⊘ Not checked');
  });

  it('never draws a computed figure or $0.00, and has no glow', () => {
    expect(html).not.toContain('$0.00');
    expect(html.match(/\$/g)).toHaveLength(1);
    expect(html).not.toMatch(/glow-/);
  });
});
