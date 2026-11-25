import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApprovalCheck, ExportPill } from './ApprovalCard';
import type { DraftView } from '../lib/draft';

const pill = (exporting: boolean) => renderToStaticMarkup(<ExportPill approved exporting={exporting} onExport={() => {}} variant="header" />);

describe('ExportPill while exporting', () => {
  it('says Exporting… in words, with an indicator that only spins when motion is allowed (R3.4)', () => {
    const html = pill(true);
    expect(html).toContain('Exporting…');
    expect(html).not.toContain('Export PDF');
    const indicator = /<span[^>]*data-testid="export-indicator"[^>]*>/.exec(html)?.[0] ?? '';
    expect(indicator).toContain('aria-hidden="true"');
    const classes = /class="([^"]*)"/.exec(indicator)?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain('motion-safe:animate-spin');
    expect(classes).not.toContain('animate-spin');
  });

  it('reads Export PDF when idle', () => {
    expect(pill(false)).toContain('Export PDF');
    expect(pill(false)).not.toContain('export-indicator');
  });
});

describe('ApprovalCheck before hydration', () => {
  it('is drawn disabled by the server, so an early tick is never undone or shown unrecorded', () => {
    const draft = { hash: 'a'.repeat(64) } as DraftView;
    const html = renderToStaticMarkup(<ApprovalCheck draft={draft} checked={false} busy={false} onChange={() => {}} variant="card" />);
    expect(/<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0]).toMatch(/\bdisabled=""/);
  });
});
