import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = import.meta.dirname;
const SKIP = new Set(['node_modules', '.next']);
const INTERACTIVE = new Set(['a', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'Link']);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/**
 * R1.2: Tab order is DOM order. A positive tabindex jumps the queue, and a CSS `order-*` class on a control moves
 * it on screen away from where Tab reaches it. Each hit is named by the tag it sits on.
 */
function tabOrderHacks(code: string): string[] {
  const hits: string[] = [];
  for (const m of code.matchAll(/tab[iI]ndex=(?:\{\s*|["'])\+?([1-9]\d*)/g)) hits.push(`tabindex ${m[1]}`);
  const tags = [...code.matchAll(/<([A-Za-z][\w.]*)\b/g)].map((m) => ({ at: m.index, tag: m[1]! }));
  for (const m of code.matchAll(/(?<=["'`\s:])-?order-[\w[\]-]+/g)) {
    const tag = tags.filter((t) => t.at < m.index).at(-1)?.tag;
    if (tag && INTERACTIVE.has(tag)) hits.push(`${m[0]} on <${tag}>`);
  }
  return hits;
}

describe('no tab order hacks', () => {
  it('flags a positive tabindex and order-* on a control, not tabIndex -1/0 or order-* on a layout box', () => {
    expect(tabOrderHacks('<div tabIndex={2} />')).toEqual(['tabindex 2']);
    expect(tabOrderHacks('<input tabindex="1">')).toEqual(['tabindex 1']);
    expect(tabOrderHacks('<button className="order-first px-4">Go</button>')).toEqual(['order-first on <button>']);
    expect(tabOrderHacks('<Link href="/" className="md:order-2 flex">x</Link>')).toEqual(['order-2 on <Link>']);
    expect(tabOrderHacks('<h1 tabIndex={-1} /><main tabIndex={0} /><div className="order-last"><a href="/">x</a></div>')).toEqual([]);
  });

  it('apps/web sources use DOM order for Tab', () => {
    const files = sources(WEB);
    expect(files.length).toBeGreaterThan(10);
    const hits = files.flatMap((f) => tabOrderHacks(readFileSync(f, 'utf8')).map((h) => `${relative(WEB, f)}: ${h}`));
    expect(hits).toEqual([]);
  });
});
