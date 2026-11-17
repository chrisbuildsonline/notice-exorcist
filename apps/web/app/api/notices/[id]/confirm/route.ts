import { confirmationsFor, confirmField } from '../../../../../lib/confirm';
import { getNotice } from '../../../../../lib/intake';
import { noticeView } from '../../../../../lib/notice-view';
import { sourced } from '../../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

/** POST { path, value }: the user confirms or corrects a flagged field. Returns the notice, checked again by duty-engine. */
export const POST = sourced(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = (await ctx.params).id;
  const body = (await req.json().catch(() => null)) as { path?: unknown; value?: unknown } | null;
  if (typeof body?.path !== 'string' || typeof body.value !== 'string') return Response.json({ error: 'path and value are required' }, { status: 400 });
  const r = confirmField(id, body.path, body.value);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(noticeView(getNotice(id)!, confirmationsFor(id)));
});
