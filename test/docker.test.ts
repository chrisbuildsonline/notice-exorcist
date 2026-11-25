import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const dockerfile = read('Dockerfile');
const readme = read('README.md');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

/** The Dockerfile split into stages: the name after `AS` and the instructions up to the next FROM. */
const stages = dockerfile
  .split(/^(?=FROM )/m)
  .filter((s) => s.startsWith('FROM '))
  .map((body) => ({ name: /^FROM \S+ AS (\S+)/.exec(body)?.[1], body }));
const stage = (name: string) => stages.find((s) => s.name === name)?.body ?? '';

describe('Dockerfile', () => {
  it('keeps a test target that runs typecheck, tests and e2e', () => {
    expect(stage('test')).toMatch(/^CMD .*bun run typecheck && bun run test && bun run e2e/m);
  });

  it('ends with the app target, so a plain docker build serves the UI', () => {
    expect(stages.at(-1)?.name).toBe('app');
  });

  it('builds the app and serves it on $PORT (default 3000) on every interface', () => {
    const app = stage('app');
    expect(app).toMatch(/^RUN bun run build$/m);
    expect(app).toMatch(/^EXPOSE 3000$/m);
    expect(app).toMatch(/^CMD .*bun run start -H 0\.0\.0\.0 --port \\?"?\$\{PORT:-3000\}/m);
  });

  it('builds the tariff index in the image and sets no extraction mode, so the specimens replay with no key', () => {
    expect(dockerfile).toMatch(/^RUN bun run --cwd packages\/tariff-data data:build$/m);
    expect(dockerfile).not.toMatch(/^(ENV|ARG) .*EXTRACT_/m);
  });
});

describe('README Run in Docker', () => {
  const section = /### Run in Docker\n([\s\S]*?)\n## /.exec(readme)?.[1] ?? '';

  it.each([
    'docker build -t notice-exorcist .',
    'docker run --rm -p 3000:3000 notice-exorcist',
    'docker build --target test -t notice-exorcist-test .',
    'docker run --rm notice-exorcist-test',
    'bun run docker:check',
  ])('shows `%s`', (cmd) => {
    expect(section).toContain(cmd);
  });

  it('no longer says the Dockerfile only runs the checks', () => {
    expect(readme).not.toMatch(/Dockerfile` only runs the checks/);
  });
});

describe('package.json docker scripts', () => {
  it('match the README commands', () => {
    expect(scripts['docker:build']).toBe('docker build -t notice-exorcist .');
    expect(scripts['docker:serve']).toBe('docker run --rm -p 3000:3000 notice-exorcist');
    expect(scripts['docker:test']).toBe('docker build --target test -t notice-exorcist-test . && docker run --rm notice-exorcist-test');
    expect(scripts['docker:check']).toBe('playwright test -c playwright.docker.config.ts');
  });
});
