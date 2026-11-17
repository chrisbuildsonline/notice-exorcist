import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { extractNotice } from './extract';
import { Notice } from './schema/notice';
import { form29ModelReply, specimenBytes, stubProvider } from './test/stub-provider';

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

  it('unsupported input never reaches the provider', async () => {
    const provider = stubProvider([JSON.stringify(form29ModelReply())]);
    const r = await extractNotice({ bytes: new TextEncoder().encode('GIF89a') }, { config, provider });
    expect(r).toMatchObject({ ok: false, reason: 'unsupported_input' });
    expect(provider.calls).toHaveLength(0);
  });
});
