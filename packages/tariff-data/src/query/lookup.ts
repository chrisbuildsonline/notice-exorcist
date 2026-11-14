import type { Database } from 'bun:sqlite';
import { isInScope, normalizeHts } from '../codes';
import { editionOf } from './db';

export type TariffProv = { kind: 'tariff'; source: string; hts: string; edition: string };

export type HtsLookup =
  | {
      status: 'ok';
      code: string;
      description: string;
      general: string;
      special: string;
      other: string;
      units: string;
      indent: number;
      ancestors: string[];
      prov: TariffProv;
    }
  | { status: 'not_found' | 'invalid_code' | 'out_of_scope'; code: string };

type Line = { seq: number; chapter: string; code: string; indent: number; description: string; general: string; special: string; other: string; units: string; source: string };

/** The HTS line for `input`, with rate text exactly as stored. No parsing, no inheritance from other lines. */
export function lookupHts(db: Database, input: string): HtsLookup {
  const code = normalizeHts(input);
  if (code === null) return { status: 'invalid_code', code: input };
  if (!isInScope(code)) return { status: 'out_of_scope', code };
  const line = db.query('SELECT * FROM hts_lines WHERE code = ?1').get(code) as Line | null;
  if (!line) return { status: 'not_found', code };

  // Walk back through the chapter: each earlier row with a lower indent is the next ancestor.
  const ancestors: string[] = [];
  let indent = line.indent;
  const earlier = db
    .query('SELECT indent, description FROM hts_lines WHERE chapter = ?1 AND seq < ?2 ORDER BY seq DESC')
    .all(line.chapter, line.seq) as { indent: number; description: string }[];
  for (const row of earlier) {
    if (indent === 0) break;
    if (row.indent < indent) {
      ancestors.push(row.description);
      indent = row.indent;
    }
  }

  const { description, general, special, other, units } = line;
  return {
    status: 'ok',
    code,
    description,
    general,
    special,
    other,
    units,
    indent: line.indent,
    ancestors,
    prov: { kind: 'tariff', source: line.source, hts: code, edition: editionOf(db) },
  };
}
