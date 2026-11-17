import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { extractNotice } from './extract';
import { Notice } from './schema/notice';
import { form29ModelReply, specimenBytes, stubProvider } from './test/stub-provider';
import { loadTruth, wrapTruthAsModel } from './test/wrap';

const png = specimenBytes('specimen-2-form29.png');
const config = readConfig({});
const run = (replies: string[]) => {
  const provider = stubProvider(replies);
  return { provider, result: extractNotice({ bytes: png }, { config, provider }) };
};

describe('extractNotice', () => {
  it('a valid response is ok: stated fields with provenance written by the package, meta filled', async () => {
    const reply = form29ModelReply();
    reply.entryNumber.box = [10, 20, 300, 40];
    const { provider, result } = run([JSON.stringify(reply)]);
    const r = await result;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Notice.safeParse(r.notice).success).toBe(true);
    expect(r.notice.entryNumber).toEqual({
      value: 'ZZ9-0423518-7',
      confidence: 0.95,
      page: 1,
      box: [10, 20, 300, 40],
      prov: { kind: 'stated', source: 'page 1, box 10,20,300,40' },
      needs_confirmation: false,
    });
    expect(r.meta).toEqual({
      kind: 'cbp_form_29',
      hash: createHash('sha256').update(png).digest('hex'),
      provider: 'ollama',
      model: 'stub-model',
    });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.images).toEqual([{ mime: 'image/png', bytes: png }]);
  });

  it('non-JSON gives not_json after one retry, and keeps the raw text for the caller', async () => {
    const { provider, result } = run(['Sure! Here is the notice: ...']);
    const r = await result;
    expect(r).toMatchObject({ ok: false, reason: 'not_json', raw: 'Sure! Here is the notice: ...' });
    expect(provider.calls).toHaveLength(2);
  });

  it('an invalid shape retries once with the issues in the prompt, then returns schema_invalid with issues', async () => {
    const bad = form29ModelReply();
    bad.lines[0].value.value = '4,815.00';
    const { provider, result } = run([JSON.stringify(bad)]);
    const r = await result;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('schema_invalid');
    expect(r.issues?.some((i) => i.path.join('.') === 'lines.0.value.value')).toBe(true);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]!.user).not.toContain('lines.0.value.value');
    expect(provider.calls[1]!.user).toContain('lines.0.value.value');
    expect(provider.calls[1]!.user.startsWith(provider.calls[0]!.user)).toBe(true);
  });

  it('a valid retry after an invalid first reply is ok', async () => {
    const bad = form29ModelReply();
    bad.kind = 'form29';
    const { provider, result } = run([JSON.stringify(bad), JSON.stringify(form29ModelReply())]);
    expect((await result).ok).toBe(true);
    expect(provider.calls).toHaveLength(2);
  });

  it('kind unknown gives unrecognized_document, without a retry', async () => {
    const { provider, result } = run(['{"kind":"unknown"}']);
    expect(await result).toMatchObject({ ok: false, reason: 'unrecognized_document' });
    expect(provider.calls).toHaveLength(1);
  });

  it('no value is defaulted or coerced: numeric money, a missing key and model-written prov all fail', async () => {
    const numeric = form29ModelReply();
    numeric.statedTotals[0].stated.value = 12845;
    const missing = form29ModelReply();
    delete missing.port;
    const prov = form29ModelReply();
    prov.port.prov = { kind: 'stated', source: 'page 1' };
    for (const reply of [numeric, missing, prov]) {
      expect(await run([JSON.stringify(reply)]).result).toMatchObject({ ok: false, reason: 'schema_invalid' });
    }
  });

  it('no value is trimmed or rewritten: odd but valid text comes back exactly', async () => {
    const reply = form29ModelReply();
    reply.lines[1].description.value = '  Card wallets,  outer surface ';
    const r = await run([JSON.stringify(reply)]).result;
    expect(r.ok && r.notice.lines[1]?.description.value).toBe('  Card wallets,  outer surface ');
  });

  it('marks fields below the threshold and lists them for confirmation', async () => {
    const reply = form29ModelReply();
    reply.lines[0].dutyStated.confidence = 0.42;
    const r = await extractNotice({ bytes: png }, { config, provider: stubProvider([JSON.stringify(reply)]), threshold: 0.8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.notice.lines[0]?.dutyStated.needs_confirmation).toBe(true);
    expect(r.needsConfirmation).toEqual(['lines[0].dutyStated']);
  });

  describe('honesty guard', () => {
    const stated = (value: string) => ({ value, confidence: 0.95, page: 1 });
    const reply = (id: string) => wrapTruthAsModel(loadTruth(id)) as Record<string, any>;
    const runOk = async (r: Record<string, any>) => {
      const res = await run([JSON.stringify(r)]).result;
      if (!res.ok) throw new Error(`expected ok, got ${res.reason}`);
      return res;
    };

    it('a clean reply of each kind carries an empty honesty list', async () => {
      for (const id of ['specimen-1-form28', 'specimen-2-form29', 'specimen-3-courier']) {
        expect((await runOk(reply(id))).honesty).toEqual([]);
      }
    });

    it('Form 28: a line duty is cleared and recorded, and the cleared path is not left for confirmation', async () => {
      const r = reply('specimen-1-form28');
      r.lines[1].dutyStated = stated('210.60');
      const res = await runOk(r);
      expect(res.notice.lines[1]?.dutyStated.value).toBeNull();
      expect(res.honesty).toEqual([{ rule: 'form28_no_line_duty', path: 'lines[1].dutyStated', action: 'cleared', modelValue: '210.60' }]);
    });

    it('Form 29: a total repeating a fee is flagged and both paths are in needsConfirmation', async () => {
      const r = reply('specimen-2-form29');
      r.statedTotals.push({ name: stated('Merchandise Processing Fee'), stated: stated('44.50') });
      const res = await runOk(r);
      expect(res.honesty.map((h) => h.path)).toEqual(['statedTotals[2].name', 'statedTotals[2].stated']);
      expect(res.needsConfirmation).toEqual(['statedTotals[2].name', 'statedTotals[2].stated']);
    });

    it('courier: the courier read as importer is flagged and both paths are in needsConfirmation', async () => {
      const r = reply('specimen-3-courier');
      r.importer.name = stated('Tumbleweed Air Parcel');
      const res = await runOk(r);
      expect(res.honesty.map((h) => [h.rule, h.path, h.action])).toEqual([
        ['courier_importer_is_courier', 'importer.name', 'flagged'],
        ['courier_importer_is_courier', 'importer.address', 'flagged'],
      ]);
      for (const h of res.honesty) expect(res.needsConfirmation).toContain(h.path);
    });

    it('runs in fixture mode too: a recorded Form 28 comes back with no line duty', async () => {
      const res = await extractNotice({ bytes: specimenBytes('specimen-1-form28.pdf') }, { config: { ...config, mode: 'fixture' } });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.notice.lines.map((l) => l.dutyStated.value)).toEqual([null, null, null]);
      expect(res.honesty.filter((h) => h.action === 'cleared').length).toBeGreaterThan(0);
    });
  });

  it('unsupported input never reaches the provider', async () => {
    const provider = stubProvider([JSON.stringify(form29ModelReply())]);
    const r = await extractNotice({ bytes: new TextEncoder().encode('GIF89a') }, { config, provider });
    expect(r).toMatchObject({ ok: false, reason: 'unsupported_input' });
    expect(provider.calls).toHaveLength(0);
  });
});
