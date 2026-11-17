import { getNotice } from '../../../../lib/intake';
import { noticeView } from '../../../../lib/notice-view';
import { sourced } from '../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

/** A notice with its reading state and, once read, every stated figure checked by duty-engine. */
export const GET = sourced(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const row = getNotice((await ctx.params).id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(noticeView(row));
});
