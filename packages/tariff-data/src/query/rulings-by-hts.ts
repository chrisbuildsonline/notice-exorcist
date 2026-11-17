import type { Database } from 'bun:sqlite';
import { normalizeHts } from '../codes';
import type { RulingHit } from './search';

export type RulingRef = Omit<RulingHit, 'snippet'>;

/**
 * Rulings citing at least one HTS code that starts with `prefix` (4, 6, 8 or 10 digits, dots optional), newest first.
 * The prefix is normalized to its dotted form and compared with substr, never LIKE, so `%`, `_` or quotes match nothing.
 */
export function rulingsByHtsPrefix(db: Database, prefix: string, opts: { limit?: number } = {}): RulingRef[] {
  const p = normalizeHts(prefix);
  if (p === null) return [];
  const rows = db
    .query(`
      SELECT r.number, r.date, r.title, r.hts_codes, r.url FROM rulings r
      WHERE EXISTS (SELECT 1 FROM ruling_codes c WHERE c.number = r.number AND substr(c.code, 1, length(?1)) = ?1)
      ORDER BY r.date DESC, r.number DESC LIMIT ?2`)
    .all(p, opts.limit ?? 10) as { number: string; date: string; title: string; hts_codes: string; url: string }[];
  return rows.map((r) => ({ number: r.number, date: r.date, title: r.title, htsCodes: r.hts_codes.split(' ').filter(Boolean), url: r.url }));
}
