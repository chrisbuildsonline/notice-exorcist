import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PKG_DIR } from './config';

const sources = [...new Bun.Glob('{src,test}/**/*.ts').scanSync(PKG_DIR)]
  .filter((f) => !f.endsWith('.test.ts'))
  .map((f) => ({ path: f, text: readFileSync(join(PKG_DIR, f), 'utf8') }));

describe('package boundaries', () => {
  test('scans the package sources', () => {
    expect(sources.map((s) => s.path)).toContain('src/query/search.ts');
  });

  test('does not import apps/web or duty-engine', () => {
    for (const s of sources) {
      expect({ path: s.path, bad: /from\s+['"][^'"]*(apps\/web|duty-engine|@notice-exorcist\/web)/.test(s.text) }).toEqual({ path: s.path, bad: false });
    }
  });

  test('only src/fetch/ touches the network', () => {
    const net = /\bfetch\s*\(|\bfetch\b\s*[,;)=]|typeof fetch|XMLHttpRequest|WebSocket|node:(http|https|net|dgram)|\bBun\.connect\b/;
    const offenders = sources.filter((s) => net.test(s.text)).map((s) => relative('.', s.path));
    expect(offenders.every((p) => p.startsWith('src/fetch/'))).toBe(true);
    expect(offenders).toContain('src/fetch/hts.ts');
  });
});
