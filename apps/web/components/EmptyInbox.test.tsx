import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Assessment } from '../lib/assess';
import { EmptyInbox, InboxHeading } from './EmptyInbox';

const fig = (value: string, prov: 'stated' | 'computed') => ({ value, prov, source: prov === 'stated' ? 'page 1' : 'duty-engine line.adValorem at 9.2%' });
const preview: Assessment = {
  lines: [
    { label: 'Line 1 · Towels', state: 'disagrees', stated: fig('385.02', 'stated'), computed: fig('442.98', 'computed'), difference: null, description: null, hts: null, rateText: null, confirm: [], calc: null },
    { label: 'Line 2 · Sheets', state: 'verified', stated: fig('120.00', 'stated'), computed: fig('120.00', 'computed'), difference: null, description: null, hts: null, rateText: null, confirm: [], calc: null },
  ],
  status: { kind: 'haunted', count: 1 },
  atStake: null,
  fog: 0.5,
  totals: { name: null, statedTotal: null, computedTotal: null, difference: null, flagged: false, calc: null },
  flags: [],
};

const html = renderToStaticMarkup(<EmptyInbox preview={preview} />);
/** Every <button> with its class list and text. */
const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ cls: m[1]!.split(/\s+/), text: m[2]!.replace(/<[^>]+>/g, '').trim() }));
const isInk = (cls: string[]) => cls.includes('bg-ink');

describe('EmptyInbox (R4)', () => {
  it('has the headline and one supporting line', () => {
    expect(html).toMatch(/<h2[^>]*>Exorcise your customs notice<\/h2>/);
    expect(html.match(/<p[^>]*data-testid="empty-line"/g)).toHaveLength(1);
    expect(html).toContain('Forward or upload a CBP Form 28, 29 or courier duty invoice. We check every figure and draft a cited reply you approve.');
  });

  it('Try a specimen is the only ink pill, posted as a form; Upload a notice is secondary', () => {
    const outside = buttons.filter((b) => !b.text.startsWith('stated:') && !b.text.startsWith('computed:'));
    const ink = outside.filter((b) => isInk(b.cls));
    expect(ink.map((b) => b.text)).toEqual(['Try a specimen']);
    expect(html).toMatch(/<form action="\/api\/specimens" method="post">\s*<button type="submit"/);
    const upload = outside.find((b) => b.text === 'Upload a notice');
    expect(upload).toBeDefined();
    expect(isInk(upload!.cls)).toBe(false);
    // the pill comes before Upload in the DOM, so Tab reaches it first
    expect(html.indexOf('Try a specimen')).toBeLessThan(html.indexOf('Upload a notice'));
  });

  it('the specimen card is decorative: hidden from the accessibility tree and out of the tab order', () => {
    const wrap = /<div([^>]*)>\s*<div data-testid="specimen-card"/.exec(html)?.[1] ?? '';
    expect(wrap).toContain('aria-hidden="true"');
    expect(wrap).toMatch(/\binert(="")?/);
  });

  it('the inbox heading shows no money figure when nothing was computed', () => {
    const head = renderToStaticMarkup(<InboxHeading total={null} caption="No notices yet" />);
    expect(head).toContain('Inbox');
    expect(head).not.toContain('$');
    expect(head).not.toContain('at-stake');
    const withTotal = renderToStaticMarkup(<InboxHeading total={fig('750.82', 'computed')} caption="at stake across 1 haunted notice" />);
    expect(withTotal).toContain('$750.82');
  });
});
