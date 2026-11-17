import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Figure } from './Figure';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('Figure', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['stated', '1284.6', '$1,284.60'],
    ['computed', '852.25', '$852.25'],
    ['tariff', '-1234567.5', '−$1,234,567.50'],
  ] as const)('renders a %s figure to 2 decimals with grouping, a true minus and its tag', (prov, value, shown) => {
    const html = renderToStaticMarkup(<Figure value={value} prov={prov} source="page 1, box 27" />);
    expect(text(html)).toContain(shown);
    expect(text(html)).toContain(prov);
    expect(html).toContain('num');
    expect(html).toContain('page 1, box 27');
    expect(html).not.toContain('-$');
  });

  it('rounds half up to cents', () => {
    expect(text(renderToStaticMarkup(<Figure value="0.125" prov="computed" source="engine" />))).toContain('$0.13');
  });

  it('throws in test when the figure has no provenance', () => {
    // @ts-expect-error prov is required at compile time
    expect(() => renderToStaticMarkup(<Figure value="10.00" source="x" />)).toThrow(/Unsourced/);
    expect(() => renderToStaticMarkup(<Figure value="10.00" prov="stated" source="" />)).toThrow(/Unsourced/);
  });

  it('renders a dash and an Unsourced pill in production, never the number', () => {
    vi.stubEnv('NODE_ENV', 'production');
    // @ts-expect-error prov is required at compile time
    const html = renderToStaticMarkup(<Figure value="10.00" source="x" />);
    expect(text(html)).toContain('—');
    expect(text(html)).toContain('Unsourced');
    expect(html).not.toContain('10.00');
  });
});
