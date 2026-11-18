import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkippedNote } from './SkippedNote';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const line3 = { label: 'Line 3 · Acacia wood side tables', reason: 'duty-engine cannot check its rate' };
const fee = { label: 'Courier disbursement fee', reason: 'duty-engine has no fee table for it' };

describe('SkippedNote (R5.10)', () => {
  it('renders nothing when no line was left out', () => {
    expect(renderToStaticMarkup(<SkippedNote skipped={[]} />)).toBe('');
  });

  it('says one line was left out of the reply, which one and why, with no money', () => {
    const html = renderToStaticMarkup(<SkippedNote skipped={[line3]} />);
    expect(html).toContain('data-testid="skipped-note"');
    expect(text(html)).toBe('1 line was left out of this reply. Line 3 · Acacia wood side tables: duty-engine cannot check its rate.');
    expect(html).not.toMatch(/\$/);
  });

  it('counts several lines and lists each with its reason', () => {
    const t = text(renderToStaticMarkup(<SkippedNote skipped={[line3, fee]} />));
    expect(t).toMatch(/^2 lines were left out of this reply\./);
    expect(t).toContain('Courier disbursement fee: duty-engine has no fee table for it.');
  });
});
