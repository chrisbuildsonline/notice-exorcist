import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './test/wrap';

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as { scripts: Record<string, string> };
const s = pkg.scripts;

/** Checks strings only. Never runs systemctl. */
describe('package scripts', () => {
  it('ollama:start is exactly the user service start', () => {
    expect(s['ollama:start']).toBe('systemctl --user start ollama');
  });

  it.each(['eval:live', 'test:live'])('%s starts Ollama, waits for the probe before any model call, and sets EXTRACT_LIVE=require', (name) => {
    const cmd = s[name]!;
    expect(cmd.startsWith('bun run ollama:start && ')).toBe(true);
    const wait = cmd.indexOf('bun run src/live/wait.ts');
    expect(wait).toBeGreaterThan(0);
    expect(cmd).toContain('EXTRACT_LIVE=require');
    expect(cmd.indexOf('EXTRACT_LIVE=require')).toBeGreaterThan(wait);
    expect(cmd).toMatch(/EXTRACT_TIMEOUT_MS=\d{6,}/);
  });

  it('eval:live records; eval:fixture runs offline', () => {
    expect(s['eval:live']).toContain('EXTRACT_MODE=record');
    expect(s['eval:live']).toContain('--mode live');
    expect(s['eval:fixture']).toContain('--mode fixture');
    expect(s['eval:fixture']).not.toContain('ollama');
  });

  it('the default test scripts leave src/live out and never start Ollama', () => {
    expect(s.test).not.toContain('ollama');
    const rootConfig = readFileSync(join(REPO_ROOT, 'vitest.config.ts'), 'utf8');
    expect(rootConfig).toContain("'packages/notice-extract/src/live/**'");
    const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(rootPkg.scripts.test).not.toContain('ollama');
  });
});
