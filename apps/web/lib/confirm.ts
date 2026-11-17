import { type ExtractResult, Notice } from '@notice-exorcist/notice-extract';
import { getDb } from './db';
import { getNotice } from './intake';

/** A value the user confirmed (or corrected) for a flagged field, by its notice-extract path. */
export type Confirmation = { path: string; value: string };

type Leaf = { value: unknown; prov: { kind: 'stated'; source: string }; needs_confirmation?: boolean };

/** The stated field at `lines[0].rateText`, walking own properties only, or null. */
function leafAt(root: unknown, path: string): Leaf | null {
  let v: unknown = root;
  for (const seg of path.split(/\.|(?=\[)/)) {
    const key = /^\[(\d+)\]$/.exec(seg)?.[1] ?? seg;
    if (!v || typeof v !== 'object' || !/^\w+$/.test(key) || !Object.hasOwn(v, key)) return null;
    v = (v as Record<string, unknown>)[key];
  }
  return v && typeof v === 'object' && 'value' in v && 'prov' in v ? (v as Leaf) : null;
}

/** A copy of the notice with each confirmed value in place, no longer flagged, and its source saying who confirmed it. */
export function applyConfirmations(notice: Notice, cs: Confirmation[]): Notice {
  const out = structuredClone(notice);
  for (const c of cs) {
    const leaf = leafAt(out, c.path);
    if (!leaf) continue;
    leaf.value = /(^|\.)n$/.test(c.path) ? Number(c.value) : c.value;
    leaf.needs_confirmation = false;
    leaf.prov = { ...leaf.prov, source: `${leaf.prov.source} · confirmed by you` };
  }
  return out;
}

export const confirmationsFor = (noticeId: string) =>
  getDb().prepare('SELECT path, value FROM confirmations WHERE notice_id = ? ORDER BY confirmed_at, rowid').all(noticeId) as Confirmation[];

export type ConfirmResult = { ok: true } | { ok: false; status: 400 | 404 | 409; error: string; path?: string };

/**
 * Records the user's values for flagged fields, all or none. Only a field that is still flagged can be confirmed,
 * and the patched notice must still validate (a duty must look like 12.34, a date like 2026-10-08).
 */
export function confirmFields(noticeId: string, values: Confirmation[]): ConfirmResult {
  const row = getNotice(noticeId);
  const r = row?.extracted_json ? (JSON.parse(row.extracted_json) as ExtractResult) : null;
  if (!r?.ok) return { ok: false, status: 404, error: 'not_found' };
  const current = applyConfirmations(r.notice, confirmationsFor(noticeId));
  const clean = values.map((c) => ({ path: c.path, value: c.value.trim() }));
  for (const c of clean) {
    if (leafAt(current, c.path)?.needs_confirmation !== true) return { ok: false, status: 409, error: 'not_flagged', path: c.path };
    if (!c.value || c.value.length > 200 || !Notice.safeParse(applyConfirmations(current, [c])).success) {
      return { ok: false, status: 400, error: 'That does not look right for this field. Check the format on the notice.', path: c.path };
    }
  }
  const db = getDb();
  const insert = db.prepare('INSERT OR REPLACE INTO confirmations (notice_id, path, value, confirmed_at) VALUES (?, ?, ?, ?)');
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    for (const c of clean) insert.run(noticeId, c.path, c.value, now);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true };
}

export const confirmField = (noticeId: string, path: string, value: string) => confirmFields(noticeId, [{ path, value }]);
