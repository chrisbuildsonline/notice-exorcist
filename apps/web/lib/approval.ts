import { getDb } from './db';
import type { DraftContent } from './draft';
import { draftHash } from './hash';

/** The stored draft fields approval reads. Its hash column is never trusted: the hash is recomputed from body_json. */
type Stored = { id: string; body_json: string };

const storedHash = (row: Stored) => draftHash(JSON.parse(row.body_json) as DraftContent);

export type ApprovalResult = { ok: true } | { ok: false; status: 400 | 409; error: 'hash_required' | 'stale_hash' };

/**
 * Records the user's approval of the exact draft they saw. `hash` is the full sha256 the client showed; it is
 * recorded only when it equals the hash recomputed from the stored draft. One approval row per draft.
 */
export async function recordApproval(row: Stored, hash: unknown): Promise<ApprovalResult> {
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, status: 400, error: 'hash_required' };
  if (hash !== (await storedHash(row))) return { ok: false, status: 409, error: 'stale_hash' };
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR REPLACE INTO approvals (draft_id, hash, approved_at) VALUES (?, ?, ?)').run(row.id, hash, new Date().toISOString());
    db.prepare("UPDATE drafts SET state = 'approved' WHERE id = ?").run(row.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true };
}

/** True only when an approval row exists and its hash equals the hash of the draft as stored now. */
export async function isApproved(row: Stored): Promise<boolean> {
  const a = getDb().prepare('SELECT hash FROM approvals WHERE draft_id = ?').get(row.id) as { hash: string } | undefined;
  return !!a && a.hash === (await storedHash(row));
}
