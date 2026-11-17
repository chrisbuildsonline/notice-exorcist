import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PKG = join(import.meta.dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'test' || name === 'node_modules' ? [] : sources(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('stated only', () => {
  it("no package source outside tests mentions 'computed': nothing here produces computed provenance", () => {
    const files = [...sources(join(PKG, 'src')), ...sources(join(PKG, 'eval'))];
    expect(files.length).toBeGreaterThan(15);
    const hits = files.filter((f) => /['"`]computed['"`]/.test(readFileSync(f, 'utf8'))).map((f) => relative(PKG, f));
    expect(hits).toEqual([]);
  });
});
