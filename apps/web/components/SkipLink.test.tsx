import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from '../app/layout';
import { SkipLink } from './SkipLink';

vi.mock('geist/font/sans', () => ({ GeistSans: { variable: 'font-sans-var' } }));
vi.mock('geist/font/mono', () => ({ GeistMono: { variable: 'font-mono-var' } }));

describe('SkipLink', () => {
  it('links to #main with plain text', () => {
    const html = renderToStaticMarkup(<SkipLink />);
    expect(html).toBe('<a href="#main" class="skip-link">Skip to main content</a>');
  });

  it('is the first element in the layout body', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>page</p>
      </RootLayout>,
    );
    expect(html).toMatch(/<body[^>]*><a href="#main" class="skip-link">Skip to main content<\/a><p>page<\/p><\/body>/);
  });

  it('is hidden until focused, then a fixed 44px pill above everything', () => {
    const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
    const rule = (sel: string) => new RegExp(`${sel.replace(/[.:]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const base = rule('.skip-link');
    const focus = rule('.skip-link:focus');
    expect(base).toMatch(/position:\s*fixed/);
    expect(base).toMatch(/transform:\s*translateY\(-200%\)/);
    expect(base).toMatch(/height:\s*44px/);
    expect(base).toMatch(/z-index:\s*50/);
    expect(focus).toMatch(/transform:\s*none/);
  });
});
