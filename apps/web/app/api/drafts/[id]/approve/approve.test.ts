import { beforeEach, describe, expect, it } from 'vitest';
import { isApproved } from '../../../../../lib/approval';
import { getDb } from '../../../../../lib/db';
import type { DraftView } from '../../../../../lib/draft';
import { contentOf, type DraftRow, ensureDraft, getDraftRow, updateDraft } from '../../../../../lib/drafts';
import { draftHash } from '../../../../../lib/hash';
import { freshDataDir, haunted } from '../../../../../lib/test-env';
import { GET } from '../route';
import { POST } from './route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const approve = (id: string, body: unknown) =>
  POST(new Request(`http://x/api/drafts/${id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(id));
const approvalRow = (id: string) => getDb().prepare('SELECT hash FROM approvals WHERE draft_id = ?').get(id) as { hash: string } | undefined;
const stateOf = async (id: string) => ((await (await GET(new Request('http://x'), ctx(id))).json()) as DraftView).state;

describe('POST /api/drafts/[id]/approve', () => {
  let draft: DraftRow;
  let hash: string;
  beforeEach(async () => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
    draft = (await ensureDraft(await haunted()))!;
    hash = await draftHash(contentOf(draft));
  });

  it('a new draft is not approved', async () => {
    expect(await isApproved(draft)).toBe(false);
    expect(await stateOf(draft.id)).toBe('draft');
    expect(approvalRow(draft.id)).toBeUndefined();
  });

  it('records the approval when the posted hash equals the hash the server recomputes', async () => {
    const res = await approve(draft.id, { hash });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DraftView).state).toBe('approved');
    expect(approvalRow(draft.id)).toEqual({ hash });
    expect(await isApproved(getDraftRow(draft.id)!)).toBe(true);
    expect(await stateOf(draft.id)).toBe('approved');
  });

  it('rejects a stale hash with 409 and records nothing', async () => {
    const c = contentOf(draft);
    const edited = await updateDraft(draft.id, c.paragraphs.map((p, i) => (i === 0 ? 'Dear Sir or Madam,' : p)));
    expect(edited.ok).toBe(true);
    const res = await approve(draft.id, { hash });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'stale_hash' });
    expect(approvalRow(draft.id)).toBeUndefined();
    expect(await stateOf(draft.id)).toBe('draft');
  });

  it('never trusts the stored hash column: the hash is recomputed from the stored content', async () => {
    getDb().prepare('UPDATE drafts SET hash = ? WHERE id = ?').run('f'.repeat(64), draft.id);
    expect((await approve(draft.id, { hash: 'f'.repeat(64) })).status).toBe(409);
    expect((await approve(draft.id, { hash })).status).toBe(200);
  });

  it.each([
    ['no hash', {}],
    ['a claim of approval with no hash', { approved: true }],
    ['a hash prefix', { hash: 'abcd' }],
  ])('rejects %s with 400', async (_why, body) => {
    expect((await approve(draft.id, body)).status).toBe(400);
    expect(approvalRow(draft.id)).toBeUndefined();
  });

  it('404s an unknown draft', async () => {
    expect((await approve('nope', { hash })).status).toBe(404);
  });

  it('derives approval from the stored record on every load, not from a state flag', async () => {
    // a state column saying approved, with no approval row, is not approved
    getDb().prepare("UPDATE drafts SET state = 'approved' WHERE id = ?").run(draft.id);
    expect(await isApproved(getDraftRow(draft.id)!)).toBe(false);
    expect(await stateOf(draft.id)).toBe('draft');

    // an approval row for other content (the body changed behind its back) is not approved either
    expect((await approve(draft.id, { hash })).status).toBe(200);
    const c = contentOf(draft);
    getDb()
      .prepare('UPDATE drafts SET body_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...c, paragraphs: ['Changed.', ...c.paragraphs.slice(1)] }), draft.id);
    expect(approvalRow(draft.id)).toEqual({ hash });
    expect(await isApproved(getDraftRow(draft.id)!)).toBe(false);
    expect(await stateOf(draft.id)).toBe('draft');
  });
});
