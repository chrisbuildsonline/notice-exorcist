import { recordApproval, revokeApproval } from '../../../../../lib/approval';
import { draftView, getDraftRow } from '../../../../../lib/drafts';
import { sourced } from '../../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** POST { hash }: approves the stored draft if `hash` is its current sha256. Anything else in the body is ignored. */
export const POST = sourced(async (req: Request, ctx: Ctx) => {
  const row = getDraftRow((await ctx.params).id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { hash?: unknown } | null;
  const r = await recordApproval(row, body?.hash);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(await draftView(getDraftRow(row.id)!));
});

/** DELETE: withdraws the approval. The draft goes back to `draft`; its text is unchanged. */
export const DELETE = sourced(async (_req: Request, ctx: Ctx) => {
  const row = getDraftRow((await ctx.params).id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  revokeApproval(row.id);
  return Response.json(await draftView(getDraftRow(row.id)!));
});
