import { describe, expect, it } from 'vitest';
import { canonicalDraft, draftHash } from './hash';

const draft = {
  paragraphs: ['Dear Officer,', 'Line 1 duty is {{fig:line1.computed}}{{cite:c1}}.'],
  figures: [{ id: 'line1.computed', value: '442.98', prov: 'computed' as const, source: 'duty-engine line.ad_valorem at 9.2%' }],
  citations: [{ id: 'c1', kind: 'notice' as const, label: 'Notice, page 1, box 34' }],
};

describe('canonicalDraft', () => {
  it('is stable JSON with sorted keys and no whitespace, over paragraphs, figures and citations only', () => {
    const extra = { ...draft, id: 'd1', state: 'approved', hash: 'x' };
    expect(canonicalDraft(extra)).toBe(canonicalDraft(draft));
    expect(canonicalDraft(draft)).toBe(
      '{"citations":[{"id":"c1","kind":"notice","label":"Notice, page 1, box 34"}],' +
        '"figures":[{"id":"line1.computed","prov":"computed","source":"duty-engine line.ad_valorem at 9.2%","value":"442.98"}],' +
        '"paragraphs":["Dear Officer,","Line 1 duty is {{fig:line1.computed}}{{cite:c1}}."]}',
    );
  });
});

describe('draftHash', () => {
  it('gives the same hash whatever the key order', async () => {
    const shuffled = {
      citations: [{ label: 'Notice, page 1, box 34', kind: 'notice' as const, id: 'c1' }],
      paragraphs: [...draft.paragraphs],
      figures: [{ source: 'duty-engine line.ad_valorem at 9.2%', prov: 'computed' as const, value: '442.98', id: 'line1.computed' }],
    };
    expect(await draftHash(shuffled)).toBe(await draftHash(draft));
  });

  it('changes with any paragraph, citation or figure change, and with paragraph order', async () => {
    const base = await draftHash(draft);
    const variants = [
      { ...draft, paragraphs: ['Dear Officer,', 'Line 1 duty is {{fig:line1.computed}}{{cite:c1}}!'] },
      { ...draft, paragraphs: ['Dear Officer, ', ...draft.paragraphs.slice(1)] },
      { ...draft, paragraphs: [...draft.paragraphs].reverse() },
      { ...draft, citations: [{ ...draft.citations[0]!, label: 'Notice, page 1, box 33' }] },
      { ...draft, citations: [] },
      { ...draft, figures: [{ ...draft.figures[0]!, value: '442.99' }] },
    ];
    for (const v of variants) expect(await draftHash(v)).not.toBe(base);
  });

  it('is the sha256 hex of the canonical form (golden value)', async () => {
    const h = await draftHash(draft);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe('759cf7c3a5382fe0c8458742c681fec60851a87e646e2b716a268b4877d36ef0');
  });
});
