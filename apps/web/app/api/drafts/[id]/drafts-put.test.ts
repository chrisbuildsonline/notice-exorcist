import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../../lib/db';
import type { DraftView } from '../../../../lib/draft';
import { contentOf, type DraftRow, ensureDraft, getDraftRow } from '../../../../lib/drafts';
import { draftHash } from '../../../../lib/hash';
import { freshDataDir, haunted } from '../../../../lib/test-env';
import { GET, PUT } from './route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const put = (id: string, body: unknown) =>
  PUT(new Request(`http://x/api/drafts/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(id));
const approvalRow = (id: string) => getDb().prepare('SELECT draft_id, hash FROM approvals WHERE draft_id = ?').get(id);

describe('draft GET and PUT', () => {
  let draft: DraftRow;
  beforeEach(async () => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
    draft = (await ensureDraft(await haunted()))!;
  });

  it('GET returns the stored draft with its hash recomputed from the content', async () => {
    const res = await GET(new Request('http://x'), ctx(draft.id));
    expect(res.status).toBe(200);
    const v = (await res.json()) as DraftView;
    expect(v.state).toBe('draft');
    expect(v.paragraphs).toEqual(contentOf(draft).paragraphs);
    expect(v.hash).toBe(await draftHash(contentOf(draft)));
    expect((await GET(new Request('http://x'), ctx('nope'))).status).toBe(404);
  });

  it('PUT after an approval stores the edit, deletes the approval row and returns to draft', async () => {
    const before = contentOf(draft);
    getDb().prepare('INSERT INTO approvals (draft_id, hash, approved_at) VALUES (?, ?, ?)').run(draft.id, await draftHash(before), new Date().toISOString());
    getDb().prepare("UPDATE drafts SET state = 'approved' WHERE id = ?").run(draft.id);
    expect(approvalRow(draft.id)).toBeTruthy();

    const paragraphs = before.paragraphs.map((p, i) => (i === 0 ? 'Dear Sir or Madam,' : p));
    const res = await put(draft.id, { paragraphs });
    expect(res.status).toBe(200);
    const v = (await res.json()) as DraftView;
    expect(v.state).toBe('draft');
    expect(v.paragraphs[0]).toBe('Dear Sir or Madam,');
    expect(v.hash).not.toBe(await draftHash(before));

    expect(approvalRow(draft.id)).toBeUndefined();
    const stored = getDraftRow(draft.id)!;
    expect(stored.state).toBe('draft');
    expect(contentOf(stored).paragraphs).toEqual(paragraphs);
    // figures and citations are the server's: an edit never changes them
    expect(contentOf(stored).figures).toEqual(before.figures);
    expect(contentOf(stored).citations).toEqual(before.citations);
    expect(stored.hash).toBe(v.hash);
  });

  it('PUT with the same text still clears the approval: any update does', async () => {
    const c = contentOf(draft);
    getDb().prepare('INSERT INTO approvals (draft_id, hash, approved_at) VALUES (?, ?, ?)').run(draft.id, await draftHash(c), new Date().toISOString());
    expect((await put(draft.id, { paragraphs: c.paragraphs })).status).toBe(200);
    expect(approvalRow(draft.id)).toBeUndefined();
  });

  it('ignores figures, citations and approval state sent by the client', async () => {
    const c = contentOf(draft);
    const res = await put(draft.id, { paragraphs: c.paragraphs, figures: [{ ...c.figures[0], value: '1.00' }], citations: [], state: 'approved', approved: true });
    expect(res.status).toBe(200);
    const v = (await res.json()) as DraftView;
    expect(v.state).toBe('draft');
    expect(v.figures).toEqual(c.figures);
    expect(v.citations).toEqual(c.citations);
  });

  it.each([
    ['a typed amount', (p: string[]) => p.map((x, i) => (i === 0 ? 'Dear Officer, you owe us $57.96.' : x))],
    ['a figure token removed', (p: string[]) => p.map((x) => x.replace(/\{\{fig:line1\.computed\}\}/, 'a lot'))],
    ['a hand-made figure token', (p: string[]) => p.map((x, i) => (i === 0 ? 'Dear Officer, {{fig:57.96}}' : x))],
    ['a paragraph added', (p: string[]) => [...p, 'One more.']],
    ['not strings', () => [1, 2]],
  ])('rejects an edit with %s (422) and changes nothing, approval included', async (_why, edit) => {
    const c = contentOf(draft);
    getDb().prepare('INSERT INTO approvals (draft_id, hash, approved_at) VALUES (?, ?, ?)').run(draft.id, await draftHash(c), new Date().toISOString());
    const res = await put(draft.id, { paragraphs: edit(c.paragraphs) });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { message: string }).message).toMatch(/./);
    expect(getDraftRow(draft.id)!.body_json).toBe(draft.body_json);
    expect(approvalRow(draft.id)).toBeTruthy();
  });

  it('404s an unknown draft', async () => {
    expect((await put('nope', { paragraphs: [] })).status).toBe(404);
  });
});
