import type { Database } from 'bun:sqlite';
import { editionOf } from './db';
import type { TariffProv } from './lookup';

export type RulingHit = { number: string; date: string; title: string; htsCodes: string[]; url: string; snippet: string };
export type HtsHit = { code: string; description: string; general: string; prov: TariffProv };

/**
 * Free text -> a safe FTS5 expression: split on non-alphanumerics, quote each token, join with AND or OR.
 * User text never reaches FTS5 syntax, so `"`, `*`, `NEAR(`, `-` or `:` cannot cause a syntax error.
 */
export function toFtsExpression(q: string, mode: 'and' | 'or'): string | null {
  const tokens = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.length ? tokens.map((t) => `"${t}"`).join(mode === 'and' ? ' AND ' : ' OR ') : null;
}

/** Run with AND first, then OR if AND finds nothing. */
function andThenOr<T>(q: string, run: (expr: string) => T[]): T[] {
  for (const mode of ['and', 'or'] as const) {
    const expr = toFtsExpression(q, mode);
    if (expr === null) return [];
    const rows = run(expr);
    if (rows.length) return rows;
  }
  return [];
}

/** Candidate rulings ranked by bm25 (title weighted 5x). Candidates with citations, not a classification. */
export function searchRulings(db: Database, q: string, opts: { limit?: number; heading?: string; chapter?: string } = {}): RulingHit[] {
  const sql = db.query(`
    SELECT r.number, r.date, r.title, r.hts_codes, r.url, snippet(rulings_fts, -1, '', '', '…', 24) AS snippet
    FROM rulings_fts JOIN rulings r ON r.rowid = rulings_fts.rowid
    WHERE rulings_fts MATCH ?1
      AND (?2 IS NULL OR EXISTS (SELECT 1 FROM ruling_codes c WHERE c.number = r.number AND c.heading = ?2))
      AND (?3 IS NULL OR EXISTS (SELECT 1 FROM ruling_codes c WHERE c.number = r.number AND substr(c.heading, 1, 2) = ?3))
    ORDER BY bm25(rulings_fts, 5.0, 1.0) LIMIT ?4`);
  type Row = { number: string; date: string; title: string; hts_codes: string; url: string; snippet: string };
  return andThenOr(q, (expr) => sql.all(expr, opts.heading ?? null, opts.chapter ?? null, opts.limit ?? 10) as Row[]).map((r) => ({
    number: r.number,
    date: r.date,
    title: r.title,
    htsCodes: r.hts_codes.split(' ').filter(Boolean),
    url: r.url,
    snippet: r.snippet.replace(/\s+/g, ' ').trim(),
  }));
}

/** HTS lines whose description matches, ranked by bm25. Rate text is returned as stored. */
export function searchHts(db: Database, q: string, opts: { limit?: number } = {}): HtsHit[] {
  const sql = db.query(`
    SELECT h.code, h.description, h.general, h.source
    FROM hts_fts JOIN hts_lines h ON h.seq = hts_fts.rowid
    WHERE hts_fts MATCH ?1 AND h.code <> ''
    ORDER BY bm25(hts_fts) LIMIT ?2`);
  type Row = { code: string; description: string; general: string; source: string };
  const rows = andThenOr(q, (expr) => sql.all(expr, opts.limit ?? 10) as Row[]);
  const edition = rows.length ? editionOf(db) : '';
  return rows.map((r) => ({
    code: r.code,
    description: r.description,
    general: r.general,
    prov: { kind: 'tariff', source: r.source, hts: r.code, edition },
  }));
}
