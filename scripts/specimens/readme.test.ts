import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>;
const specimensSection = /## Specimens\n([\s\S]*?)(?=\n## |$)/.exec(readme)?.[1] ?? '';

describe('README Specimens section', () => {
  it('names the command and the output folder', () => {
    expect(specimensSection).toContain('bun run specimens:generate');
    expect(specimensSection).toContain('fixtures/specimens/');
  });

  it('keeps the license notes accurate: specimens MIT, tariff data public domain', () => {
    expect(specimensSection).toContain('MIT');
    expect(specimensSection).toMatch(/public domain/i);
  });

  it('leaves the Measured accuracy placeholder untouched', () => {
    expect(readme).toContain('Measured accuracy: [fill in measured result].');
  });
});

describe('root scripts', () => {
  it('has specimens:generate, and bun run test does not run it', () => {
    expect(scripts['specimens:generate']).toBe('bun scripts/specimens/generate.ts');
    expect(scripts.test).not.toContain('specimens:generate');
    expect(scripts.test).not.toContain('generate.ts');
  });
});
