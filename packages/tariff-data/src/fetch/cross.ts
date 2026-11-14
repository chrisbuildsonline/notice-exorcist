import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { headingOf, parseTariffField } from '../codes';
import { CROSS_BASE, REQUEST_GAP_MS, RULINGS_PER_HEADING, USER_AGENT } from '../config';
import { CrossRuling } from '../schemas';
import { type FileEntry, sha256, writeAtomic } from './io';

type Opts = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
  refresh?: boolean;
  cap?: number;
  gapMs?: number;
};

/**
 * Download the selected CROSS rulings (heading -> ruling numbers) into `<dataDir>/rulings/<number>.json`.
 * CROSS search needs a reCAPTCHA token, so the selection is a configured list; each ruling is checked
 * to be classified under its heading. The record is stored as received minus `url`, a presigned S3 link
 * that expires after 15 minutes and carries an AWS key id.
 */
export async function fetchRulings(dataDir: string, selection: Record<string, readonly string[]>, opts: Opts = {}) {
  const { fetch: fetchFn = fetch, sleep = Bun.sleep, refresh = false, cap = RULINGS_PER_HEADING, gapMs = REQUEST_GAP_MS } = opts;
  const files: Record<string, FileEntry> = {};
  const failures: string[] = [];

  for (const [heading, numbers] of Object.entries(selection)) {
    for (const n of numbers.slice(0, cap)) {
      const path = `rulings/${n}.json`;
      if (!refresh && existsSync(join(dataDir, path))) continue;
      const url = `${CROSS_BASE}/api/ruling/${n}`;
      try {
        await sleep(gapMs);
        const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { url: _presigned, ...record } = (await res.json()) as Record<string, unknown>;
        const parsed = CrossRuling.safeParse(record);
        if (!parsed.success) throw new Error(`${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message}`);
        if (parsed.data.rulingNumber !== n) throw new Error(`got ruling ${parsed.data.rulingNumber}`);
        if (!parseTariffField(parsed.data.tariffs).some((c) => headingOf(c) === heading)) {
          throw new Error(`not classified under ${heading} (tariffs: ${parsed.data.tariffs})`);
        }
        const body = `${JSON.stringify(record, null, 2)}\n`;
        writeAtomic(join(dataDir, path), body);
        files[path] = { url, retrievedAt: new Date().toISOString(), sha256: sha256(body) };
      } catch (e) {
        failures.push(`${n}: ${(e as Error).message}`);
      }
    }
  }
  return { files, failures };
}
