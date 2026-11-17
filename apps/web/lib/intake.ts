import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Config, extractNotice, type ExtractResult, readConfig, sniff } from '@notice-exorcist/notice-extract';
import { dataDir, type Db, getDb, repoRoot, SPECIMENS } from './db';

export const MAX_BYTES = 10 * 1024 * 1024;
const MIME = { pdf: 'application/pdf', png: 'image/png', jpeg: 'image/jpeg' } as const;

export type Source = 'upload' | 'email' | 'specimen';

export type Checked = { ok: true; mime: string } | { ok: false; status: 413 | 415; error: string };

/** Type by magic bytes (never the name or the client's content type), size up to 10 MB. */
export function checkFile(bytes: Uint8Array): Checked {
  if (bytes.byteLength > MAX_BYTES) return { ok: false, status: 413, error: 'That file is over 10 MB.' };
  const type = sniff(bytes);
  if (!type) return { ok: false, status: 415, error: 'That file is not a PDF, PNG or JPEG.' };
  return { ok: true, mime: MIME[type] };
}

/**
 * Reading config: the EXTRACT_* env, but recorded fixtures unless EXTRACT_MODE says otherwise,
 * so the app runs with no model and no key. Specimens always replay their recording.
 */
function extractConfig(source: Source): Config {
  const c = readConfig();
  return { ...c, mode: source === 'specimen' || !process.env.EXTRACT_MODE ? 'fixture' : c.mode };
}

async function read(db: Db, id: string, bytes: Uint8Array, source: Source): Promise<void> {
  let result: ExtractResult;
  try {
    result = await extractNotice({ bytes }, { config: extractConfig(source), fixturesDir: join(repoRoot(), 'packages', 'notice-extract', 'fixtures') });
  } catch {
    result = { ok: false, reason: 'model_unreachable', hash: '' };
  }
  // The raw model reply is never stored.
  const stored = result.ok ? result : { ok: false, reason: result.reason, hash: result.hash };
  db.prepare('UPDATE notices SET status = ?, kind = ?, extracted_json = ? WHERE id = ?')
    .run(result.ok ? 'ready' : 'failed', result.ok ? result.notice.kind : null, JSON.stringify(stored), id);
}

/** Stores a checked file and starts reading it. `settled` resolves when the reading is stored. */
export function fileNotice(input: { bytes: Uint8Array; filename: string; source: Source }): { id: string; settled: Promise<void> } {
  const checked = checkFile(input.bytes);
  if (!checked.ok) throw new Error(checked.error);
  const id = randomUUID();
  const dir = join(dataDir(), 'files');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, id);
  writeFileSync(filePath, input.bytes);
  const db = getDb();
  db.prepare('INSERT INTO notices (id, status, created_at, source, filename, mime, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, 'reading', new Date().toISOString(), input.source, input.filename.slice(0, 200), checked.mime, filePath);
  return { id, settled: read(db, id, input.bytes, input.source) };
}

/** Files one bundled specimen (the haunted Form 29 unless another id is named). */
export function fileSpecimen(id = SPECIMENS[0]!.id) {
  const s = SPECIMENS.find((x) => x.id === id);
  if (!s) return null;
  return fileNotice({ bytes: new Uint8Array(readFileSync(s.path)), filename: s.filename, source: 'specimen' });
}

/** Seed: files every bundled specimen. */
export function seedSpecimens() {
  return SPECIMENS.map((s) => fileSpecimen(s.id)!);
}

export type NoticeRow = {
  id: string;
  kind: string | null;
  status: 'reading' | 'ready' | 'failed';
  created_at: string;
  source: Source;
  filename: string;
  extracted_json: string | null;
};

const COLS = 'id, kind, status, created_at, source, filename, extracted_json';

export const listNotices = () => getDb().prepare(`SELECT ${COLS} FROM notices ORDER BY created_at DESC, rowid DESC`).all() as NoticeRow[];

export const getNotice = (id: string) => (getDb().prepare(`SELECT ${COLS} FROM notices WHERE id = ?`).get(id) as NoticeRow | undefined) ?? null;
