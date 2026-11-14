import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { INDEX_PATH } from '../config';

export class IndexNotBuiltError extends Error {
  constructor(path: string) {
    super(`tariff index not found at ${path}; run \`bun run data:build\` in packages/tariff-data`);
    this.name = 'IndexNotBuiltError';
  }
}

export function openIndex(path: string = INDEX_PATH): Database {
  if (!existsSync(path)) throw new IndexNotBuiltError(path);
  return new Database(path, { readonly: true });
}

export const editionOf = (db: Database) =>
  (db.query("SELECT value FROM meta WHERE key = 'edition'").get() as { value: string }).value;
