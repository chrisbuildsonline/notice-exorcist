import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// node:sqlite, not bun:sqlite: `next start` and vitest run under Node. Same SQLite, FTS5 included.
export type Db = DatabaseSync;

/** The repo root: the first folder up from the cwd that holds fixtures/specimens (cwd is apps/web under `next start`). */
export function repoRoot(from = process.cwd()): string {
  let dir = from;
  while (!existsSync(join(dir, 'fixtures', 'specimens'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error('repo root not found (no fixtures/specimens above the cwd)');
    dir = up;
  }
  return dir;
}

/** Synthetic notices bundled with the repo, each with a recorded reading in packages/notice-extract/fixtures. */
export const SPECIMENS = ['specimen-2-form29', 'specimen-3-courier', 'specimen-1-form28'].map((id) => ({
  id,
  filename: `${id}.pdf`,
  path: join(repoRoot(), 'fixtures', 'specimens', `${id}.pdf`),
}));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  kind TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_json TEXT
);
CREATE TABLE IF NOT EXISTS lines (
  id TEXT PRIMARY KEY,
  notice_id TEXT NOT NULL REFERENCES notices(id),
  n INTEGER NOT NULL,
  stated_json TEXT,
  computed_json TEXT,
  state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  notice_id TEXT NOT NULL REFERENCES notices(id),
  body_json TEXT NOT NULL,
  hash TEXT NOT NULL,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
  draft_id TEXT PRIMARY KEY REFERENCES drafts(id),
  hash TEXT NOT NULL,
  approved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inbox_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS rulings USING fts5(number, date, hts, text);
`;

export function migrate(db: Db, opts: { inboxToken?: string } = {}): void {
  db.exec(SCHEMA);
  if (opts.inboxToken) db.prepare('INSERT OR IGNORE INTO inbox_tokens (token, user_id) VALUES (?, ?)').run(opts.inboxToken, 'local');
}

export function openDb(path: string, opts: { inboxToken?: string } = {}): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrate(db, opts);
  return db;
}

/** Where notices and their files live: NOTICE_DATA_DIR, or .data at the repo root. */
export const dataDir = () => process.env.NOTICE_DATA_DIR || join(repoRoot(), '.data');

/** The token in the forward address `notices+<token>@<domain>`. */
export const inboxToken = () => process.env.INBOX_TOKEN || 'demo';

let cached: { dir: string; db: Db } | undefined;

/** The app database, reopened if NOTICE_DATA_DIR changes (tests). */
export function getDb(): Db {
  const dir = dataDir();
  if (cached?.dir !== dir) cached = { dir, db: openDb(join(dir, 'notices.db'), { inboxToken: inboxToken() }) };
  return cached.db;
}
