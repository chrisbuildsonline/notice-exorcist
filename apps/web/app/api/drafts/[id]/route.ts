import { draftView, getDraftRow, updateDraft } from '../../../../lib/drafts';
import { sourced } from '../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** The stored draft, its hash recomputed from the content and its state from the stored record. */
export const GET = sourced(async (_req: Request, ctx: Ctx) => {
  const row = getDraftRow((await ctx.params).id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(await draftView(row));
});

/** PUT { paragraphs }: new text for the draft. Anything else in the body is ignored. Clears any approval. */
export const PUT = sourced(async (req: Request, ctx: Ctx) => {
  const body = (await req.json().catch(() => null)) as { paragraphs?: unknown } | null;
  const r = await updateDraft((await ctx.params).id, body?.paragraphs);
  if (!r.ok) return Response.json({ error: r.error, message: r.message, paragraph: r.paragraph }, { status: r.status });
  return Response.json(await draftView(r.row));
});
