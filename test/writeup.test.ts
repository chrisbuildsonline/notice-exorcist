import { existsSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const docs = ['README.md', ...globSync('docs/**/*.md', { cwd: root })];

describe('README and docs/', () => {
  it.each(docs)('%s has no "[fill in" placeholder left', (f) => {
    expect(read(f)).not.toContain('[fill in');
  });
});

describe('docs/DEVPOST.md', () => {
  const devpost = existsSync(join(root, 'docs/DEVPOST.md')) ? read('docs/DEVPOST.md') : '';
  const results = read('packages/notice-extract/eval/results/RESULTS.md');

  it('is the write-up with every Devpost section', () => {
    for (const h of ['Inspiration', 'What it does', 'How we built it', 'Challenges', 'Accomplishments', 'What we learned', "What's next", 'How we used Kiro'])
      expect(devpost).toContain(`## ${h}`);
  });

  it('quotes the eval figures that RESULTS.md holds, as in-sample', () => {
    expect(results).toContain('96.3% (234 of 243 fields)');
    expect(results).toContain('100% (9 of 9)');
    expect(devpost).toContain('96.3%');
    expect(devpost).toContain('234 of 243');
    expect(devpost).toContain('9 of 9');
    expect(devpost).toMatch(/in-sample/i);
  });

  it('does not repeat the old overclaims', () => {
    // the hooks ask the agent to check; nothing blocks a commit
    expect(devpost).not.toMatch(/block(s|ed)? commits/i);
    // the web app reads the index directly; tariff-mcp is for Kiro
    expect(devpost).not.toMatch(/(product|app) (also )?calls (it|tariff-mcp|the (MCP )?server)/i);
    // the plain-English notes and the drafts are built in code
    expect(devpost).not.toMatch(/model (explains|writes|drafts)/i);
  });
});
