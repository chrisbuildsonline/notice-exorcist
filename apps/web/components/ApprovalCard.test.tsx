import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExportPill } from './ApprovalCard';

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
