import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb, repoRoot } from './db';

/** Points the app at a fresh, empty data dir. Call in beforeEach. */
export function freshDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'notices-'));
  process.env.NOTICE_DATA_DIR = dir;
  return dir;
}

export const specimenBytes = (file: string) => new Uint8Array(readFileSync(join(repoRoot(), 'fixtures', 'specimens', file)));

export const noticeCount = () => (getDb().prepare('SELECT count(*) AS n FROM notices').get() as { n: number }).n;

export const storedFiles = (dir: string) => {
  try {
    return readdirSync(join(dir, 'files'));
  } catch {
    return [];
  }
};
