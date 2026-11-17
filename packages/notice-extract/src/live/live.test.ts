import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_INPUTS } from '../../eval/run-eval';
import { readConfig } from '../config';
import { extractNotice } from '../extract';
import { Notice } from '../schema/notice';
import { SPECIMEN_DIR } from '../test/wrap';
import { liveGate } from './probe';

/** Live acceptance: the five inputs through Ollama. Skips loudly when Ollama or Chromium is down; fails under EXTRACT_LIVE=require. */
const config = { ...readConfig(), mode: 'live' as const };
const ollama = await liveGate(`live extraction via ${config.model}`, 'ollama', { config });
const chromium = await liveGate('live extraction of PDF inputs', 'chromium', { config });

describe.skipIf(ollama.skip || chromium.skip)(`live extraction (${config.model})`, () => {
  it.each(ACCEPTANCE_INPUTS)(
    '$file extracts to schema-valid JSON of the right kind',
    async ({ file, specimenId }) => {
      const bytes = new Uint8Array(readFileSync(join(SPECIMEN_DIR, file)));
      const truth = JSON.parse(readFileSync(join(SPECIMEN_DIR, `${specimenId}.fields.json`), 'utf8')) as { kind: string };
      const r = await extractNotice({ bytes }, { config });
      expect(r.ok ? 'ok' : `${r.reason} ${r.detail ?? ''} ${JSON.stringify(r.issues?.slice(0, 5) ?? [])}`).toBe('ok');
      if (!r.ok) return;
      expect(Notice.safeParse(r.notice).success).toBe(true);
      expect(r.notice.kind).toBe(truth.kind);
    },
    config.timeoutMs * 2 + 120_000,
  );
});
