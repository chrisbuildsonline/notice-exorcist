import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../config';
import { extractNotice } from '../extract';
import { loadTruth, wrapTruthAsModel } from '../test/wrap';
import { specimenBytes, stubProvider } from '../test/stub-provider';
import { Fixture } from './fixture';

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const pdf = specimenBytes('specimen-1-form28.pdf');
const raw = JSON.stringify(wrapTruthAsModel(loadTruth('specimen-1-form28')));

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'notice-fixtures-'));
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('network is blocked in this test');
  });
});
afterEach(() => vi.restoreAllMocks());

const writeFixture = (inputSha256: string, text: string) =>
  writeFileSync(
    join(dir, `${inputSha256}.json`),
    JSON.stringify({
      inputSha256,
      responseSha256: sha(text),
      raw: text,
      provider: 'ollama',
      model: 'qwen2.5vl:7b',
      recordedAt: '2026-11-17T00:00:00.000Z',
      recordedFrom: 'live',
    }),
  );

describe('fixture mode', () => {
  it('a hit on a PDF returns the recorded notice without rasterizing or any network call', async () => {
    writeFixture(sha(pdf), raw);
    const rasterize = vi.fn();
    const r = await extractNotice({ bytes: pdf }, { config: readConfig({ EXTRACT_MODE: 'fixture' }), fixturesDir: dir, rasterize });
    expect(r).toMatchObject({ ok: true, meta: { kind: 'cbp_form_28', provider: 'fixture', model: 'qwen2.5vl:7b', hash: sha(pdf) } });
    expect(rasterize).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a miss returns no_fixture', async () => {
    const r = await extractNotice({ bytes: pdf }, { config: readConfig({ EXTRACT_MODE: 'fixture' }), fixturesDir: dir, rasterize: vi.fn() });
    expect(r).toMatchObject({ ok: false, reason: 'no_fixture' });
  });

  it('a recorded invalid reply gives the same failure, with no retry', async () => {
    writeFixture(sha(pdf), '{"kind":"cbp_form_28"}');
    const r = await extractNotice({ bytes: pdf }, { config: readConfig({ EXTRACT_MODE: 'fixture' }), fixturesDir: dir, rasterize: vi.fn() });
    expect(r).toMatchObject({ ok: false, reason: 'schema_invalid' });
  });

  it('a fixture whose raw does not match responseSha256 is rejected as no_fixture', async () => {
    writeFixture(sha(pdf), raw);
    const f = JSON.parse(readFileSync(join(dir, `${sha(pdf)}.json`), 'utf8'));
    writeFileSync(join(dir, `${sha(pdf)}.json`), JSON.stringify({ ...f, raw: raw.replace('3240.00', '3240.01') }));
    const r = await extractNotice({ bytes: pdf }, { config: readConfig({ EXTRACT_MODE: 'fixture' }), fixturesDir: dir, rasterize: vi.fn() });
    expect(r).toMatchObject({ ok: false, reason: 'no_fixture' });
  });
});

describe('record mode', () => {
  it('calls the provider and writes the raw reply with metadata to the fixtures dir', async () => {
    const png = specimenBytes('specimen-2-form29.png');
    const reply = JSON.stringify(wrapTruthAsModel(loadTruth('specimen-2-form29')));
    const provider = stubProvider([reply]);
    const r = await extractNotice(
      { bytes: png },
      { config: readConfig({ EXTRACT_MODE: 'record' }), provider, fixturesDir: dir, now: () => new Date('2026-11-17T10:00:00.000Z') },
    );
    expect(r.ok).toBe(true);
    expect(readdirSync(dir)).toEqual([`${sha(png)}.json`]);
    const written = JSON.parse(readFileSync(join(dir, `${sha(png)}.json`), 'utf8'));
    expect(written).toEqual({
      inputSha256: sha(png),
      responseSha256: sha(reply),
      raw: reply,
      provider: 'ollama',
      model: 'stub-model',
      recordedAt: '2026-11-17T10:00:00.000Z',
      recordedFrom: 'live',
    });
    expect(Fixture.safeParse(written).success).toBe(true);
  });

  it('records the final reply when the first one needed the retry', async () => {
    const png = specimenBytes('specimen-2-form29.png');
    const good = JSON.stringify(wrapTruthAsModel(loadTruth('specimen-2-form29')));
    const provider = stubProvider(['not json', good]);
    await extractNotice({ bytes: png }, { config: readConfig({ EXTRACT_MODE: 'record' }), provider, fixturesDir: dir });
    expect(JSON.parse(readFileSync(join(dir, `${sha(png)}.json`), 'utf8')).raw).toBe(good);
  });
});
