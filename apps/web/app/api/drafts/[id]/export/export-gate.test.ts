import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordApproval } from '../../../../../lib/approval';
import { getDb } from '../../../../../lib/db';
import { contentOf, type DraftRow, ensureDraft, getDraftRow, updateDraft } from '../../../../../lib/drafts';
import { draftHash } from '../../../../../lib/hash';
import { freshDataDir, haunted } from '../../../../../lib/test-env';
import { POST } from './route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const exportPdf = (id: string, body?: unknown) =>
  POST(
    new Request(`http://x/api/drafts/${id}/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    ctx(id),
  );

/** A 403 with the gate's error and no PDF in it. */
async function expectBlocked(res: Response) {
  expect(res.status).toBe(403);
  expect(res.headers.get('content-type')).toMatch(/application\/json/);
  const text = await res.text();
  expect(text).not.toContain('%PDF');
  expect(JSON.parse(text)).toEqual({ error: 'approval_required' });
}

describe('POST /api/drafts/[id]/export', () => {
  let draft: DraftRow;
  let hash: string;
  beforeEach(async () => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
    draft = (await ensureDraft(await haunted()))!;
    hash = await draftHash(contentOf(draft));
  });

  it('returns 403 and no PDF for a direct request with no approval', async () => {
    await expectBlocked(await exportPdf(draft.id));
  });

  it('returns 403 when the approval is for a stale hash', async () => {
    expect((await recordApproval(draft, hash)).ok).toBe(true);
    // the stored body changes behind the approval's back: the approval row stays, for the old hash
    const c = contentOf(draft);
    getDb()
      .prepare('UPDATE drafts SET body_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...c, paragraphs: ['Changed.', ...c.paragraphs.slice(1)] }), draft.id);
    expect(getDb().prepare('SELECT hash FROM approvals WHERE draft_id = ?').get(draft.id)).toEqual({ hash });
    await expectBlocked(await exportPdf(draft.id));
  });

  it('returns 403 after an edit to an approved draft', async () => {
    expect((await recordApproval(draft, hash)).ok).toBe(true);
    const c = contentOf(draft);
    expect((await updateDraft(draft.id, c.paragraphs.map((p, i) => (i === 0 ? 'Dear Sir or Madam,' : p)))).ok).toBe(true);
    await expectBlocked(await exportPdf(draft.id));
  });

  it('ignores a request body claiming approval', async () => {
    await expectBlocked(await exportPdf(draft.id, { approved: true, state: 'approved', hash }));
    // a state column saying approved, with no approval row, does not count either
    getDb().prepare("UPDATE drafts SET state = 'approved' WHERE id = ?").run(draft.id);
    await expectBlocked(await exportPdf(draft.id, { approved: true }));
  });

  it('returns the PDF of the approved draft when the approval matches the stored draft', async () => {
    expect((await recordApproval(draft, hash)).ok).toBe(true);
    const res = await exportPdf(draft.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="[\w.-]+\.pdf"$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const task = getDocument({ data: bytes, useSystemFonts: true });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const text = ((await page.getTextContent()).items as { str?: string }[]).map((t) => t.str ?? '').join('');
    expect(text).toContain(hash);
    expect(text).toContain('Dear Officer,');
    expect(Math.round((page.view as number[])[2]!)).toBe(612);
    await task.destroy();
  }, 60_000);

  it('prints on A4 when asked', async () => {
    expect((await recordApproval(draft, hash)).ok).toBe(true);
    const res = await exportPdf(draft.id, { paper: 'A4' });
    expect(res.status).toBe(200);
    const task = getDocument({ data: new Uint8Array(await res.arrayBuffer()), useSystemFonts: true });
    const page = await (await task.promise).getPage(1);
    expect(Math.abs((page.view as number[])[2]! - 595)).toBeLessThanOrEqual(1);
    await task.destroy();
  }, 60_000);

  it('404s an unknown draft', async () => {
    expect((await exportPdf('nope')).status).toBe(404);
    expect(getDraftRow('nope')).toBeNull();
  });
});
