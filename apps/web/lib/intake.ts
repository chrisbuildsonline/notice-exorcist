import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Config, extractNotice, type ExtractResult, readConfig } from '@notice-exorcist/notice-extract';
import { dataDir, type Db, getDb, repoRoot, SPECIMENS } from './db';
import { MAX_BYTES } from './limits';
import { checkUpload } from './upload-check';

export type Source = 'upload' | 'email' | 'specimen';

/** Recorded model replies, keyed by the sha256 of the input file. */
export const fixturesDir = () => join(repoRoot(), 'packages', 'notice-extract', 'fixtures');

/**
 * Buffers the request body, stopping as soon as it passes the cap for `files` files (plus room for base64 and
 * the envelope), whatever Content-Length claims. Returns a copy of the request to parse, or null when too big.
 */
export async function cappedRequest(req: Request, files = 1): Promise<Request | null> {
  const limit = files * MAX_BYTES * 1.4 + 256 * 1024;
  if (Number(req.headers.get('content-length') ?? 0) > limit) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      size += r.value.byteLength;
      // Stop reading; the rest is never buffered.
      if (size > limit) return null;
      chunks.push(r.value);
    }
  }
  return new Request(req.url, { method: req.method, headers: req.headers, body: Buffer.concat(chunks) });
}

/**
 * Reading config: the EXTRACT_* env, but recorded fixtures unless EXTRACT_MODE says otherwise,
 * so the app runs with no model and no key. Specimens always replay their recording.
 */
export function extractConfig(source: Source): Config {
  const c = readConfig();
  return { ...c, mode: source === 'specimen' || !process.env.EXTRACT_MODE ? 'fixture' : c.mode };
}

/** CONFIRM_BELOW: fields read with less confidence than this must be confirmed (default: notice-extract's 0.8). */
export function confirmBelow(): number | undefined {
  const v = Number(process.env.CONFIRM_BELOW);
  return process.env.CONFIRM_BELOW && v > 0 && v <= 1 ? v : undefined;
}

async function read(db: Db, id: string, bytes: Uint8Array, source: Source): Promise<void> {
  let result: ExtractResult;
  try {
    result = await extractNotice({ bytes }, { config: extractConfig(source), fixturesDir: fixturesDir(), threshold: confirmBelow() });
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
  const checked = checkUpload(input.bytes);
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

/**
 * Reads a failed notice again from its stored original (never changed). Null for an unknown id, 'not_failed' when
 * the notice is reading or read already.
 */
export function rereadNotice(id: string): { settled: Promise<void> } | 'not_failed' | null {
  const db = getDb();
  const row = db.prepare('SELECT status, source, file_path FROM notices WHERE id = ?').get(id) as { status: string; source: Source; file_path: string } | undefined;
  if (!row) return null;
  if (row.status !== 'failed') return 'not_failed';
  db.prepare("UPDATE notices SET status = 'reading', extracted_json = NULL WHERE id = ?").run(id);
  return { settled: read(db, id, new Uint8Array(readFileSync(row.file_path)), row.source) };
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
