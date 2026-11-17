import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_INPUTS } from '../eval/run-eval';
import { readConfig } from './config';
import { extractNotice, validateResponse } from './extract';
import { DEFAULT_FIXTURES_DIR, Fixture, sha256 } from './providers/fixture';
import { Notice } from './schema/notice';
import { SPECIMEN_DIR } from './test/wrap';

/** The committed live recordings, checked offline: no Ollama, no Chromium. */
const inputs = ACCEPTANCE_INPUTS.map((a) => {
  const bytes = new Uint8Array(readFileSync(join(SPECIMEN_DIR, a.file)));
  return { ...a, bytes, sha: sha256(bytes) };
});
const files = readdirSync(DEFAULT_FIXTURES_DIR).filter((f) => f.endsWith('.json'));

describe('recorded fixtures', () => {
  it('one fixture per acceptance input, named by the sha256 of the input file', () => {
    expect(files.sort()).toEqual(inputs.map((i) => `${i.sha}.json`).sort());
  });

  it.each(inputs)('$file: fixture is a live qwen2.5vl:7b recording whose raw reply parses as a Notice', ({ sha }) => {
    const f = Fixture.parse(JSON.parse(readFileSync(join(DEFAULT_FIXTURES_DIR, `${sha}.json`), 'utf8')));
    expect(f.inputSha256).toBe(sha);
    expect(f.responseSha256).toBe(sha256(f.raw));
    expect(f.provider).toBe('ollama');
    expect(f.model).toBe('qwen2.5vl:7b');
    expect(f.recordedFrom).toBe('live');
    // raw is the model's shape (no prov): validateResponse parses it with ModelNotice, adds provenance, then parses with Notice.
    const v = validateResponse(f.raw);
    expect(v.ok ? 'ok' : `${v.reason} ${JSON.stringify(v.issues?.slice(0, 5).map((i) => i.path.join('.')) ?? [])}`).toBe('ok');
    if (v.ok) expect(Notice.safeParse(v.notice).success).toBe(true);
  });

  it.each(inputs)('$file: fixture-mode extractNotice returns ok', async ({ bytes }) => {
    const r = await extractNotice({ bytes }, { config: { ...readConfig({}), mode: 'fixture' } });
    expect(r.ok ? 'ok' : r.reason).toBe('ok');
  });
});
