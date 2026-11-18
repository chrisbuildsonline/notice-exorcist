import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import type { DraftContent, DraftView } from './draft';
import { buildDraft, canDraft, type LineTariff } from './draft-builder';
import { confirmationsFor } from './confirm';
import { draftHash } from './hash';
import { getNotice } from './intake';
import { noticeView } from './notice-view';
import { htsCandidates, openTariff, rulingsFor } from './tariff';

export type DraftRow = { id: string; notice_id: string; body_json: string; hash: string; state: 'draft' | 'approved'; updated_at: string };

const COLS = 'id, notice_id, body_json, hash, state, updated_at';

export const getDraftRow = (id: string) => (getDb().prepare(`SELECT ${COLS} FROM drafts WHERE id = ?`).get(id) as DraftRow | undefined) ?? null;

export const draftRowFor = (noticeId: string) =>
  (getDb().prepare(`SELECT ${COLS} FROM drafts WHERE notice_id = ?`).get(noticeId) as DraftRow | undefined) ?? null;

export const contentOf = (row: DraftRow) => JSON.parse(row.body_json) as DraftContent;

/** The HTS candidates and CROSS rulings for each line, or nulls when the tariff index is not built. */
function tariffFor(lines: Parameters<typeof htsCandidates>[1][]): LineTariff[] {
  const db = openTariff();
  if (!db) return lines.map(() => null);
  try {
    return lines.map((l) => ({ candidates: htsCandidates(db, l), rulings: rulingsFor(db, l) }));
  } finally {
    db.close();
  }
}

/**
 * The notice's draft, built from its provenance records the first time it is asked for (state `draft`, never
 * approved). Null when there is nothing to dispute yet. One draft per notice.
 */
export async function ensureDraft(noticeId: string): Promise<DraftRow | null> {
  const have = draftRowFor(noticeId);
  if (have) return have;
  const row = getNotice(noticeId);
  if (!row) return null;
  const v = noticeView(row, confirmationsFor(noticeId));
  if (!canDraft(v)) return null;
  const content = buildDraft(v, tariffFor(v.assessment!.lines));
  getDb()
    .prepare('INSERT OR IGNORE INTO drafts (id, notice_id, body_json, hash, state, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), noticeId, JSON.stringify(content), await draftHash(content), 'draft', new Date().toISOString());
  return draftRowFor(noticeId);
}

/** What the API and the page show. The hash is recomputed from the stored content, never read from a column or a client. */
export async function draftView(row: DraftRow): Promise<DraftView> {
  const content = contentOf(row);
  return { id: row.id, noticeId: row.notice_id, ...content, hash: await draftHash(content), state: row.state === 'approved' ? 'approved' : 'draft' };
}
