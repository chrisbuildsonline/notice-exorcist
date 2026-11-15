import { describe, expect, it } from 'vitest';
import { FOOTER_TEXT, esc, fmtDate, fmtMoney, page } from './base';

const html = page('Sample notice', '<p>body</p>');

describe('base page', () => {
  it('has the exact footer line from R3.2', () => {
    expect(FOOTER_TEXT).toBe('SPECIMEN. Fictional document for software testing. Not issued by CBP or any courier.');
    expect(html).toContain(`<footer class="footer">${FOOTER_TEXT}</footer>`);
  });

  it('has a fixed diagonal SPECIMEN stamp in real text, below the content', () => {
    expect(html).toMatch(/<div class="stamp" aria-hidden="true">(\s*<span>SPECIMEN( SPECIMEN)*<\/span>)+\s*<\/div>/);
    expect(html).toMatch(/\.stamp\s*\{[^}]*position:\s*fixed/);
    expect(html).toMatch(/\.stamp\s*\{[^}]*pointer-events:\s*none/);
    expect(html).toMatch(/\.stamp\s*\{[^}]*z-index:\s*0/);
    expect(html).toMatch(/\.sheet\s*\{[^}]*z-index:\s*1/);
  });

  it('has a boxed SPECIMEN mark', () => {
    expect(html).toContain('<div class="mark">SPECIMEN</div>');
    expect(html).toMatch(/\.mark\s*\{[^}]*position:\s*fixed/);
    expect(html).toMatch(/\.mark\s*\{[^}]*border:/);
  });

  it('puts the body inside the sheet', () => {
    expect(html).toContain('<p>body</p>');
    expect(html).toContain('<title>Sample notice</title>');
  });

  it('loads no remote or external resource and runs no script', () => {
    expect(html).not.toMatch(/https?:/i);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link|@import|url\(|\bsrc=/i);
  });

  it('uses only the DESIGN.md greys for the chrome, no accent or status hues', () => {
    const colours = new Set(html.match(/#[0-9a-f]{3,6}\b/gi)?.map((c) => c.toLowerCase()));
    expect([...colours].sort()).toEqual(['#14161c', '#646a79', '#e6e8ee', '#fff']);
  });

  it('formats money, dates and text without arithmetic', () => {
    expect(fmtMoney('12845.00')).toBe('$12,845.00');
    expect(fmtMoney('0.00')).toBe('$0.00');
    expect(fmtMoney('1234567.89')).toBe('$1,234,567.89');
    expect(fmtDate('2026-10-08')).toBe('10/08/2026');
    expect(esc('Brindle & Wick <Co> "x"')).toBe('Brindle &amp; Wick &lt;Co&gt; &quot;x&quot;');
  });
});
