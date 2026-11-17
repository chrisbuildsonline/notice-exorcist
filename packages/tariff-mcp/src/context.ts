import { openIndex } from '@notice-exorcist/tariff-data';

type Db = ReturnType<typeof openIndex>;

/** The index file exists but SQLite cannot read it (truncated, not a database, wrong schema). */
export class IndexUnreadableError extends Error {
  override name = 'IndexUnreadableError';
  constructor() {
    super('tariff index is unreadable; check TARIFF_INDEX_PATH or rebuild it with `bun run --cwd packages/tariff-data data:build`');
  }
}

let db: Db | null = null;

/**
 * The read-only index, opened on first use and cached. The path comes from TARIFF_INDEX_PATH (default
 * packages/tariff-data/.cache/tariff.sqlite). Opening inside a handler makes a missing index a tool error, not a crash.
 */
export function getDb(): Db {
  if (db) return db;
  const opened = openIndex();
  try {
    opened.query('PRAGMA schema_version').get();
  } catch {
    opened.close();
    throw new IndexUnreadableError();
  }
  db = opened;
  return db;
}

export function closeDb() {
  db?.close();
  db = null;
}
