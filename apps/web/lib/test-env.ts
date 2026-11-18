import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmationsFor, confirmFields } from './confirm';
import { getDb, repoRoot } from './db';
import { fileNotice, getNotice } from './intake';
import { noticeView } from './notice-view';

/** Points the app at a fresh, empty data dir. Call in beforeEach. */
export function freshDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'notices-'));
  process.env.NOTICE_DATA_DIR = dir;
  return dir;
}

export const specimenBytes = (file: string) => new Uint8Array(readFileSync(join(repoRoot(), 'fixtures', 'specimens', file)));

/** Files the haunted Form 29 specimen and confirms its flagged values as read, so it can be drafted. Returns its id. */
export async function haunted(): Promise<string> {
  const { id, settled } = fileNotice({ bytes: specimenBytes('specimen-2-form29.pdf'), filename: 'specimen-2-form29.pdf', source: 'upload' });
  await settled;
  const a = noticeView(getNotice(id)!, confirmationsFor(id)).assessment!;
  const flags = [...a.flags, ...a.lines.flatMap((l) => l.confirm)];
  const r = confirmFields(id, flags.map((f) => ({ path: f.path, value: f.read ?? '' })));
  if (!r.ok) throw new Error(`confirm failed: ${r.error}`);
  return id;
}

/**
 * A compound rate with a condition the duty-engine parser does not model (`parseRateText` returns unsupported), so
 * the engine cannot check the line. The e2e test types the same text into the confirm form.
 */
export const UNSUPPORTED_RATE = '2.4¢/kg + 5% (see note)';

/**
 * The SPECIMEN Form 29 with every value confirmed as read, except line 3's rate, which the user confirms as
 * UNSUPPORTED_RATE. The reader is made to flag every field (CONFIRM_BELOW), as the e2e strict server does.
 */
export async function withUnsupportedRate(): Promise<string> {
  process.env.CONFIRM_BELOW = '0.96';
  try {
    const { id, settled } = fileNotice({ bytes: specimenBytes('specimen-2-form29.pdf'), filename: 'specimen-2-form29.pdf', source: 'upload' });
    await settled;
    const a = noticeView(getNotice(id)!, confirmationsFor(id)).assessment!;
    const flags = [...a.flags, ...a.lines.flatMap((l) => l.confirm)];
    const values = flags.map((f) => ({ path: f.path, value: f.path === 'lines[2].rateText' ? UNSUPPORTED_RATE : (f.read ?? '') }));
    if (!values.some((v) => v.value === UNSUPPORTED_RATE)) throw new Error('line 3 rate was not flagged');
    const r = confirmFields(id, values);
    if (!r.ok) throw new Error(`confirm failed: ${r.error}`);
    return id;
  } finally {
    delete process.env.CONFIRM_BELOW;
  }
}

export const noticeCount =() => (getDb().prepare('SELECT count(*) AS n FROM notices').get() as { n: number }).n;

export const storedFiles = (dir: string) => {
  try {
    return readdirSync(join(dir, 'files'));
  } catch {
    return [];
  }
};
