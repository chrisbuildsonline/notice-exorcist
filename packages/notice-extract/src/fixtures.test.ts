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

describe('recorded fixtures replayed through the honesty guard', () => {
  const replay = async (file: string) => {
    const input = inputs.find((i) => i.file === file)!;
    const path = join(DEFAULT_FIXTURES_DIR, `${input.sha}.json`);
    const before = readFileSync(path, 'utf8');
    const r = await extractNotice({ bytes: input.bytes }, { config: { ...readConfig({}), mode: 'fixture' } });
    const after = readFileSync(path, 'utf8');
    expect(after).toBe(before);
    const f = Fixture.parse(JSON.parse(after));
    expect(f.responseSha256).toBe(sha256(f.raw));
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    return { r, raw: JSON.parse(f.raw) as Record<string, any> };
  };

  it('Form 28: the recorded raw keeps the model duties, the replay clears every one and names each line', async () => {
    const { r, raw } = await replay('specimen-1-form28.pdf');
    const recorded = raw.lines.map((l: any) => l.dutyStated.value);
    expect(recorded.filter((v: unknown) => v !== null).length).toBeGreaterThan(0);
    if (r.notice.kind !== 'cbp_form_28') throw new Error(r.notice.kind);
    expect(r.notice.lines.map((l) => l.dutyStated.value)).toEqual(recorded.map(() => null));
    expect(r.honesty).toEqual(
      recorded.flatMap((v: string | null, i: number) =>
        v === null ? [] : [{ rule: 'form28_no_line_duty', path: `lines[${i}].dutyStated`, action: 'cleared', modelValue: v }],
      ),
    );
  });

  it.each(['specimen-2-form29.pdf', 'specimen-2-form29.png', 'specimen-2-form29.photo.jpg'])(
    '%s: the repeated MPF total is kept as recorded and left for confirmation',
    async (file) => {
      const { r, raw } = await replay(file);
      expect(raw.statedTotals[2].name.value).toBe('Merchandise Processing Fee');
      expect(raw.statedTotals[2].stated.value).toBe('44.50');
      expect(r.notice.statedTotals[2]?.stated.value).toBe('44.50');
      expect(r.needsConfirmation).toEqual(expect.arrayContaining(['statedTotals[2].name', 'statedTotals[2].stated']));
    },
  );

  it('courier: the importer read as the courier is kept as recorded and left for confirmation', async () => {
    const { r, raw } = await replay('specimen-3-courier.pdf');
    expect(raw.importer.name.value).toBe('Tumbleweed Air Parcel');
    expect(r.notice.importer.name.value).toBe('Tumbleweed Air Parcel');
    expect(r.needsConfirmation).toEqual(expect.arrayContaining(['importer.address', 'importer.name']));
  });
});
