import { recordApproval } from '../../../../../lib/approval';
import { draftView, getDraftRow } from '../../../../../lib/drafts';
import { sourced } from '../../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

/** POST { hash }: approves the stored draft if `hash` is its current sha256. Anything else in the body is ignored. */
export const POST = sourced(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const row = getDraftRow((await ctx.params).id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { hash?: unknown } | null;
  const r = await recordApproval(row, body?.hash);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(await draftView(getDraftRow(row.id)!));
});
