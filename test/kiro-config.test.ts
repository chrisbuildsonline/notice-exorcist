import { globSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const hooksDir = join(root, '.kiro/hooks');
const mcpFile = join(root, '.kiro/settings/mcp.json');

const EXPECTED_HOOKS = ['engine-property-tests', 'ui-money-literals', 'spec-task-has-test', 'refresh-fixture-index'];

const skipBuildDirs = (p: string) => /(^|[/\\])(node_modules|\.next|\.git)$/.test(p);
const matchesSomething = (pattern: string) => globSync(pattern, { cwd: root, exclude: skipBuildDirs }).length > 0;

const files = readdirSync(hooksDir);
const hooks = files.map((f) => [f, JSON.parse(readFileSync(join(hooksDir, f), 'utf8'))] as const);

describe('.kiro/hooks', () => {
  it('has at least 4 hook files, all *.kiro.hook', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) expect(f).toMatch(/\.kiro\.hook$/);
  });

  it('has the expected hook names', () => {
    expect(hooks.map(([, h]) => h.name)).toEqual(expect.arrayContaining(EXPECTED_HOOKS));
  });

  it.each(hooks)('%s has the hook shape', (_, h) => {
    expect(typeof h.enabled).toBe('boolean');
    for (const key of ['name', 'description', 'version']) {
      expect(typeof h[key]).toBe('string');
      expect(h[key].trim()).not.toBe('');
    }
    expect(typeof h.when?.type).toBe('string');
    expect(Array.isArray(h.when.patterns)).toBe(true);
    expect(h.when.patterns.length).toBeGreaterThan(0);
    for (const p of h.when.patterns) expect(typeof p).toBe('string');
    expect(h.then?.type).toBe('askAgent');
    expect(typeof h.then.prompt).toBe('string');
    expect(h.then.prompt.trim()).not.toBe('');
  });

  it.each(hooks)('%s patterns each match a real path', (_, h) => {
    for (const p of h.when.patterns as string[]) {
      expect(matchesSomething(p), `${p} matches nothing`).toBe(true);
    }
  });
});

describe('.kiro/settings/mcp.json', () => {
  const server = JSON.parse(readFileSync(mcpFile, 'utf8')).mcpServers?.['tariff-mcp'];

  it('defines tariff-mcp with a command and args', () => {
    expect(typeof server?.command).toBe('string');
    expect(Array.isArray(server.args)).toBe(true);
  });

  it('never auto-approves calculate_duty', () => {
    expect(server.autoApprove ?? []).not.toContain('calculate_duty');
  });
});
