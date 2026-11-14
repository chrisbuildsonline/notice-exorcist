// Test-only: reads the package's own source files. Scoped to non-test sources, so tests may use node:fs.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = import.meta.dirname;
const PKG = resolve(SRC, '..');
const sources = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => ({ path: f, text: readFileSync(join(SRC, f), 'utf8') }));

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const ALLOWED_PACKAGES = new Set(['decimal.js', 'zod']);

describe('duty-engine boundary (structure.md: no network, filesystem or model access)', () => {
  it('scans the engine sources and nothing else', () => {
    expect(sources.map((s) => s.path).sort()).toEqual(
      ['compare.ts', 'decimal.ts', 'fee-table.ts', 'fees.ts', 'index.ts', 'line-duty.ts', 'provenance.ts', 'rate-text.ts'].sort(),
    );
  });

  it('imports only decimal.js, zod and files inside the package', () => {
    const bad: string[] = [];
    for (const s of sources) {
      for (const [, spec] of s.text.matchAll(SPECIFIER)) {
        if (ALLOWED_PACKAGES.has(spec!)) continue;
        const inside = spec!.startsWith('.') && !relative(PKG, resolve(dirname(join(SRC, s.path)), spec!)).startsWith('..');
        if (!inside) bad.push(`${s.path}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('uses no network, filesystem, process or model APIs', () => {
    const io = /\bfetch\b|XMLHttpRequest|WebSocket|\bnode:|\bBun\.|\bDeno\.|process\.env|ollama|bedrock|openai/i;
    expect(sources.filter((s) => io.test(s.text)).map((s) => s.path)).toEqual([]);
  });

  it('would catch a forbidden import (self-check of the scanner)', () => {
    const probe = `import { readFileSync } from 'node:fs';\nimport { lookupHts } from '@notice-exorcist/tariff-data';\nconst x = await import('../../tariff-data/src/index');`;
    expect([...probe.matchAll(SPECIFIER)].map((m) => m[1])).toEqual(['node:fs', '@notice-exorcist/tariff-data', '../../tariff-data/src/index']);
  });
});
