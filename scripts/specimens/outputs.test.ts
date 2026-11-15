import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SPECIMENS } from './data';
import { serialize } from './serialize';

// Runs the real generator (bun + Playwright Chromium) into a temp dir. It never writes to fixtures/.
const ROOT = join(import.meta.dirname, '../..');
const run = (out: string, env: NodeJS.ProcessEnv = process.env) =>
  spawnSync('bun', ['scripts/specimens/generate.ts', '--out', out], { cwd: ROOT, env, encoding: 'utf8', timeout: 120_000 });

export const pdfPageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
export const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

const EXPECTED_FILES = SPECIMENS.flatMap((s) => ['pdf', 'png', 'fields.json'].map((ext) => `${s.specimenId}.${ext}`)).sort();

describe('generator outputs', () => {
  let out: string;
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'specimens-'));
    const r = run(out);
    expect(r.status, r.stderr).toBe(0);
  }, 120_000);

  it('writes exactly the expected files and nothing else', () => {
    expect(readdirSync(out).sort()).toEqual(EXPECTED_FILES);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId]))('%s.pdf is a PDF with at least one page', (id) => {
    const pdf = readFileSync(join(out, `${id}.pdf`));
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(1);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId]))('%s.png is page 1 at 816 x 1056, scale 2', (id) => {
    const png = readFileSync(join(out, `${id}.png`));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(pngSize(png)).toEqual({ width: 1632, height: 2112 });
  });

  it.each(SPECIMENS.map((s) => [s.specimenId, s] as const))('%s.fields.json is the serialized specimen', (id, s) => {
    expect(readFileSync(join(out, `${id}.fields.json`), 'utf8')).toBe(serialize(s));
  });
});

describe('generator preflight', () => {
  it('exits non-zero naming the build step when the tariff index is missing, and writes nothing', () => {
    const out = mkdtempSync(join(tmpdir(), 'specimens-missing-'));
    const r = run(out, { ...process.env, TARIFF_INDEX_PATH: join(out, 'no-such-index.sqlite') });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('bun run --cwd packages/tariff-data data:build');
    expect(readdirSync(out)).toEqual([]);
  });

  it('exits non-zero naming the install step when Chromium is not installed, and writes nothing', () => {
    const out = mkdtempSync(join(tmpdir(), 'specimens-nochrome-'));
    const r = run(out, { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(out, 'no-browsers') });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('bunx playwright install chromium');
    expect(readdirSync(out)).toEqual([]);
  });

  it('imports nothing from apps/web', () => {
    const dir = join(ROOT, 'scripts/specimens');
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const f of files) expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/apps\/web|@notice-exorcist\/web/);
  });
});
