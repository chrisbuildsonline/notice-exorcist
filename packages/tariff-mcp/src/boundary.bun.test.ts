import { describe, expect, test } from 'bun:test';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mcpEntry, repoRoot } from './harness.bun.test';

const src = import.meta.dir;
const files = globSync('**/*.ts', { cwd: src }).filter((f) => !f.endsWith('.test.ts'));

// The server does no math, no network, writes nothing to stdout but protocol, and never reaches into the web app.
const FORBIDDEN: [string, RegExp][] = [
  ['decimal.js', /decimal\.js/],
  ['Number(', /\bNumber\(/],
  ['parseFloat', /\bparseFloat\b/],
  ['fetch(', /\bfetch\(/],
  ['process.stdout', /process\.stdout/],
  ['console.log', /console\.log/],
  ['apps/web import', /from\s+['"][^'"]*(apps\/web|@notice-exorcist\/web)/],
];

describe('tariff-mcp boundaries', () => {
  test('scans the server sources', () => {
    expect(files).toContain('server.ts');
    expect(files).toContain('tools/calculate-duty.ts');
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  test.each(FORBIDDEN)('no %s in non-test sources', (_, pattern) => {
    const hits = files.filter((f) => pattern.test(readFileSync(join(src, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  test('.kiro/settings/mcp.json runs this server and never auto-approves calculate_duty', () => {
    const entry = mcpEntry() as { args: string[]; autoApprove?: string[] };
    expect(entry.args.at(-1)).toBe('packages/tariff-mcp/src/server.ts');
    expect(entry.autoApprove ?? []).not.toContain('calculate_duty');
  });

  test('root test and typecheck scripts include this package', () => {
    const { scripts } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(scripts.test).toContain('packages/tariff-mcp');
    expect(scripts.typecheck).toContain('packages/tariff-mcp');
  });
});
