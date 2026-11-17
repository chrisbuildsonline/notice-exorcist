import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { repoRoot } from './db';

/**
 * Read-only queries over the tariff-data index (packages/tariff-data/.cache/tariff.sqlite).
 * tariff-data itself runs on bun:sqlite; the web app runs under Node, so it reads the same tables with node:sqlite.
 * Rate text is returned exactly as stored. These are candidates with citations, never a classification.
 */

export type HtsCandidate = { code: string; description: string; rate: string; source: string; edition: string; printed: boolean };
export type RulingRef = { number: string; date: string; title: string; url: string };
type Query = { hts: string | null; description: string | null };

export const tariffIndexPath = () => process.env.TARIFF_INDEX_PATH || join(repoRoot(), 'packages', 'tariff-data', '.cache', 'tariff.sqlite');

/** The index, or null when it has not been built (`bun run data:build` in packages/tariff-data). */
export function openTariff(path = tariffIndexPath()): DatabaseSync | null {
  if (!existsSync(path)) return null;
  return new DatabaseSync(path, { readOnly: true });
}

/** '6302910000' or '6302.91.00' -> '6302.91.00'; null unless 4, 6, 8 or 10 digits (same rule as tariff-data). */
function normalize(input: string | null): string | null {
  const s = input?.trim() ?? '';
  if (!/^[\d.\s]+$/.test(s)) return null;
  const d = s.replace(/\D/g, '');
  if (![4, 6, 8, 10].includes(d.length) || d.startsWith('00')) return null;
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join('.');
}

/** Free text -> quoted FTS5 tokens, so user text never reaches FTS5 syntax. */
function fts(q: string | null, mode: 'AND' | 'OR'): string | null {
  const tokens = (q ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.length ? tokens.map((t) => `"${t}"`).join(` ${mode} `) : null;
}

function andThenOr<T>(q: string | null, run: (expr: string) => T[]): T[] {
  for (const mode of ['AND', 'OR'] as const) {
    const expr = fts(q, mode);
    if (expr === null) return [];
    const rows = run(expr);
    if (rows.length) return rows;
  }
  return [];
}

type Line = { code: string; description: string; general: string; source: string };

const edition = (db: DatabaseSync) => (db.prepare("SELECT value FROM meta WHERE key = 'edition'").get() as { value: string } | undefined)?.value ?? '';

/** The printed code's HTS line, then lines whose description matches the goods. Only lines with rate text. */
export function htsCandidates(db: DatabaseSync, q: Query, limit = 3): HtsCandidate[] {
  const ed = edition(db);
  const out: HtsCandidate[] = [];
  const code = normalize(q.hts);
  if (code) {
    const byCode = db.prepare('SELECT code, description, general, source FROM hts_lines WHERE code = ?');
    const own = byCode.get(code) as Line | undefined;
    // A 10-digit statistical suffix has no rate of its own: the rate is on its 8-digit line, cited as that line.
    const rated = own?.general ? own : code.length === 13 ? (byCode.get(code.slice(0, 10)) as Line | undefined) : undefined;
    if (own && rated?.general) out.push({ code, description: own.description, rate: rated.general, source: rated.source, edition: ed, printed: true });
  }
  const search = db.prepare(`
    SELECT h.code, h.description, h.general, h.source FROM hts_fts JOIN hts_lines h ON h.seq = hts_fts.rowid
    WHERE hts_fts MATCH ? AND h.code <> '' AND h.general <> '' ORDER BY bm25(hts_fts) LIMIT ?`);
  const hits = andThenOr(q.description, (expr) => search.all(expr, limit + 1) as Line[]);
  for (const h of hits) {
    if (out.length >= limit) break;
    if (out.some((c) => c.code === h.code)) continue;
    out.push({ code: h.code, description: h.description, rate: h.general, source: h.source, edition: ed, printed: false });
  }
  return out;
}

/** CROSS rulings citing the printed subheading, then its heading, then a text match on the goods. Newest first. */
export function rulingsFor(db: DatabaseSync, q: Query, limit = 3): RulingRef[] {
  const out: RulingRef[] = [];
  const add = (rows: RulingRef[]) => {
    for (const r of rows) if (out.length < limit && !out.some((x) => x.number === r.number)) out.push(r);
  };
  const code = normalize(q.hts);
  const byPrefix = db.prepare(`
    SELECT r.number, r.date, r.title, r.url FROM rulings r
    WHERE EXISTS (SELECT 1 FROM ruling_codes c WHERE c.number = r.number AND substr(c.code, 1, length(?1)) = ?1)
    ORDER BY r.date DESC, r.number DESC LIMIT ?2`);
  if (code) for (const p of [code.slice(0, 7), code.slice(0, 4)]) add(byPrefix.all(p, limit) as RulingRef[]);
  if (out.length < limit) {
    const search = db.prepare(`
      SELECT r.number, r.date, r.title, r.url FROM rulings_fts JOIN rulings r ON r.rowid = rulings_fts.rowid
      WHERE rulings_fts MATCH ? ORDER BY bm25(rulings_fts, 5.0, 1.0) LIMIT ?`);
    add(andThenOr(q.description, (expr) => search.all(expr, limit) as RulingRef[]));
  }
  return out.map(({ number, date, title, url }) => ({ number, date, title, url }));
}
