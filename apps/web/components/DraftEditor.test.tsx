import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checkParagraph, type DraftView } from '../lib/draft';
import { DraftEditor } from './DraftEditor';

const text = (html: string) =>
  html
    .replace(/<span[^>]*role="tooltip"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<span[^>]*popover="auto"[^>]*>.*?<br\/>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const line1 = 'Line 1 (Cotton towels, HTS 6302.91.00): the notice states duty of {{fig:line1.stated}}{{cite:c1}}, at the 9.2% rate we get {{fig:line1.computed}}{{cite:c2}}.';

const draft: DraftView = {
  id: 'd1',
  noticeId: 'n1',
  state: 'draft',
  hash: 'a'.repeat(64),
  paragraphs: ['Dear Officer,', line1, 'Please review the line above.'],
  figures: [
    { id: 'line1.stated', value: '385.02', prov: 'stated', source: 'page 1, box 34' },
    { id: 'line1.computed', value: '442.98', prov: 'computed', source: 'duty-engine line.ad_valorem at 9.2%' },
  ],
  citations: [
    { id: 'c1', kind: 'notice', label: 'Notice, page 1, box 34' },
    { id: 'c2', kind: 'hts', label: 'HTS 6302.91.00 · 9.1% · 2026 Basic Edition', href: 'https://hts.usitc.gov/search?query=6302.91.00' },
  ],
};

describe('DraftEditor', () => {
  // React writes the attribute as contentEditable; HTML attribute names are case-insensitive.
  const html = renderToStaticMarkup(<DraftEditor draft={draft} />).replaceAll('contentEditable=', 'contenteditable=');

  it('renders each paragraph as a plain-text block', () => {
    const blocks = [...html.matchAll(/<div[^>]*data-testid="draft-block"[^>]*>/g)].map((m) => m[0]);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) {
      expect(b).toContain('contenteditable="plaintext-only"');
      expect(b).toContain('role="textbox"');
    }
  });

  it('draws figures through Figure as non-editable tokens bound to their record', () => {
    const tokens = [...html.matchAll(/<span[^>]*data-token="fig:([\w.]+)"[^>]*>/g)];
    expect(tokens.map((m) => m[1])).toEqual(['line1.stated', 'line1.computed']);
    for (const t of tokens) expect(t[0]).toContain('contenteditable="false"');
    expect(text(html)).toContain('$385.02 stated');
    expect(text(html)).toContain('$442.98 computed');
    expect(html).toContain('aria-label="computed: duty-engine line.ad_valorem at 9.2%"');
  });

  it('draws citation chips numbered in order that link to the sources list', () => {
    const chips = [...html.matchAll(/<a[^>]*data-token="cite:(c\d)"[^>]*>([^<]*)<\/a>/g)];
    expect(chips.map((m) => [m[1], m[2]])).toEqual([
      ['c1', '[1]'],
      ['c2', '[2]'],
    ]);
    for (const c of chips) {
      expect(c[0]).toContain(`href="#source-${c[1]}"`);
      expect(c[0]).toContain('bg-accent-50');
      expect(c[0]).toContain('contenteditable="false"');
    }
    expect(html).toMatch(/id="source-c1"[^>]*>.*Notice, page 1, box 34/);
    expect(html).toMatch(/id="source-c2"[^>]*>.*href="https:\/\/hts\.usitc\.gov\/search\?query=6302\.91\.00"/);
  });

  it('ends with the sources and the not-legal-advice line', () => {
    const t = text(html);
    expect(t).toMatch(/Sources .*\[1\] Notice, page 1, box 34 .*\[2\] HTS 6302\.91\.00/);
    expect(t).toContain('Not legal advice. Draft only, never filed.');
  });
});

describe('checkParagraph (what the editor accepts)', () => {
  it('accepts words, the rate text, the HTS code and the entry number', () => {
    expect(checkParagraph(line1, line1.replace('the notice states', 'your notice shows'))).toBeNull();
    expect(checkParagraph(line1, `${line1} Entry 123-4567890-1, rate 9.2%, HTS 6302.91.00.`)).toBeNull();
  });

  it.each([
    ['a typed figure in place of the token', line1.replace('{{fig:line1.computed}}', '$442.98')],
    ['a typed figure in place of the token, no sign', line1.replace('{{fig:line1.computed}}', '442.98')],
    ['a typed number as a figure token', line1.replace('{{fig:line1.computed}}', '{{fig:442.98}}')],
    ['a typed amount next to the token', `${line1} We paid $400 already.`],
    ['a typed grouped amount', `${line1} We paid 1,250 already.`],
    ['a typed amount in words', `${line1} We paid 400 dollars.`],
    ['a second copy of a token', `${line1} {{fig:line1.stated}}`],
    ['a dropped citation', line1.replace('{{cite:c1}}', '')],
  ])('rejects %s', (_why, next) => {
    expect(checkParagraph(line1, next)).toMatch(/./);
  });

  it('rejects a line break: a paragraph is one line of plain text', () => {
    expect(checkParagraph('Dear Officer,', 'Dear Officer,\nHello')).toMatch(/./);
  });
});
