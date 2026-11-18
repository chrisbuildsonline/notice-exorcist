import { randomUUID } from 'node:crypto';
import { isApproved } from './approval';
import { getDb } from './db';
import { checkParagraph, type DraftContent, type DraftView } from './draft';
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

export type UpdateResult = { ok: true; row: DraftRow } | { ok: false; status: 404 | 422; error: string; message: string; paragraph?: number };

/**
 * Stores new paragraph text. Only the words change: each paragraph must keep its figure and citation tokens and
 * hold no typed amount (the editor's rule, checked again here). Figures and citations stay the server's.
 * The update and the deletion of any approval happen in one transaction, so an edited draft is never approved.
 */
export async function updateDraft(id: string, paragraphs: unknown): Promise<UpdateResult> {
  const row = getDraftRow(id);
  if (!row) return { ok: false, status: 404, error: 'not_found', message: 'No such draft.' };
  const current = contentOf(row);
  const invalid = (message: string, paragraph?: number): UpdateResult => ({ ok: false, status: 422, error: 'invalid_edit', message, paragraph });
  if (!Array.isArray(paragraphs) || !paragraphs.every((p) => typeof p === 'string')) return invalid('paragraphs must be a list of strings.');
  if (paragraphs.length !== current.paragraphs.length) return invalid('Paragraphs can’t be added or removed.');
  for (const [i, p] of paragraphs.entries()) {
    const why = checkParagraph(current.paragraphs[i]!, p);
    if (why) return invalid(why, i);
  }
  const content: DraftContent = { ...current, paragraphs };
  const hash = await draftHash(content);
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("UPDATE drafts SET body_json = ?, hash = ?, state = 'draft', updated_at = ? WHERE id = ?").run(JSON.stringify(content), hash, new Date().toISOString(), id);
    db.prepare('DELETE FROM approvals WHERE draft_id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true, row: getDraftRow(id)! };
}

/**
 * What the API and the page show. The hash is recomputed from the stored content, never read from a column or a
 * client, and the state is derived from the approval record on every load.
 */
export async function draftView(row: DraftRow): Promise<DraftView> {
  const content = contentOf(row);
  return { id: row.id, noticeId: row.notice_id, ...content, hash: await draftHash(content), state: (await isApproved(row)) ? 'approved' : 'draft' };
}
