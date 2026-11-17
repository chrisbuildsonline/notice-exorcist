import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { markNeedsConfirmation } from '../src/confidence';
import type { ExtractResult } from '../src/extract';
import { Notice } from '../src/schema/notice';
import { loadTruth, wrapTruth } from '../src/test/wrap';
import { runEval, writeResults } from './run-eval';

const truth29 = loadTruth('specimen-2-form29');
const truth28 = loadTruth('specimen-1-form28');

/** Form 29 read with two wrong fields, one of them flagged; Form 28 failed outright. */
function stubExtract(name: string): ExtractResult {
  if (name === 'b.pdf') return { ok: false, reason: 'schema_invalid', hash: 'b'.repeat(64) };
  const n = Notice.parse(wrapTruth(truth29)) as Record<string, any>;
  n.lines[0].hts.value = '6302.91.01';
  n.lines[0].hts.confidence = 0.5;
  n.entryNumber.value = 'ZZ9-0423518-1';
  const notice = markNeedsConfirmation(n as Notice);
  return { ok: true, notice, needsConfirmation: [], honesty: [], meta: { kind: 'cbp_form_29', hash: 'a'.repeat(64), provider: 'ollama', model: 'm' } };
}

const inputs = [
  { file: 'a.png', specimenId: 'specimen-2-form29', bytes: new Uint8Array([1]), truth: truth29 },
  { file: 'b.pdf', specimenId: 'specimen-1-form28', bytes: new Uint8Array([2]), truth: truth28 },
];

describe('eval', async () => {
  const r = await runEval({ inputs, extract: async (i) => stubExtract(i.file), model: 'm', now: () => new Date('2026-11-17T00:00:00Z') });
  const total29 = r.inputs[0]!.total;
  const total28 = r.inputs[1]!.total;

  it('per input: matched and total; a failed input counts all its truth fields as wrong', () => {
    expect(r.inputs[0]).toMatchObject({ file: 'a.png', ok: true, schemaValid: true, kind: 'cbp_form_29', matched: total29 - 2 });
    expect(r.inputs[1]).toMatchObject({ file: 'b.pdf', ok: false, reason: 'schema_invalid', schemaValid: false, matched: 0 });
    expect(total28).toBeGreaterThan(30);
    expect(r.inputs[1]!.wrong).toHaveLength(total28);
  });

  it('overall rate over every field of every input', () => {
    expect(r.overall).toEqual({ matched: total29 - 2, total: total29 + total28, rate: Number((((total29 - 2) / (total29 + total28)) * 100).toFixed(1)) });
  });

  it('per path rate, with array indexes removed', () => {
    expect(r.perField['lines[].hts']).toEqual({ matched: 3, total: 4 + 3, rate: Number(((3 / 7) * 100).toFixed(1)) });
    expect(r.perField.entryNumber).toEqual({ matched: 0, total: 2, rate: 0 });
    expect(r.perField.noticeType).toEqual({ matched: 1, total: 2, rate: 50 });
  });

  it('flagged share of wrong fields', () => {
    const wrong = 2 + total28;
    expect(r.flaggedWrong).toEqual({ flagged: 1, wrong, rate: Number(((1 / wrong) * 100).toFixed(1)) });
  });

  it('writes latest.json and RESULTS.md', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-'));
    writeResults(dir, r);
    expect(JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(r)));
    const md = readFileSync(join(dir, 'RESULTS.md'), 'utf8');
    expect(existsSync(join(dir, 'RESULTS.md'))).toBe(true);
    expect(md).toContain(`${r.overall.rate}%`);
    expect(md).toContain('lines[].hts');
    expect(r.inputs[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(md).toContain(r.inputs[0]!.sha256);
  });
});
