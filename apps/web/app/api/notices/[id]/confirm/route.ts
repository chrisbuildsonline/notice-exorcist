import { type Confirmation, confirmationsFor, confirmFields } from '../../../../../lib/confirm';
import { getNotice } from '../../../../../lib/intake';
import { noticeView } from '../../../../../lib/notice-view';
import { sourced } from '../../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

const isPair = (x: unknown): x is Confirmation =>
  !!x && typeof x === 'object' && typeof (x as Confirmation).path === 'string' && typeof (x as Confirmation).value === 'string';

/**
 * POST { path, value } or { values: [{ path, value }] }: the user confirms or corrects flagged fields, all or none.
 * Returns the notice, checked again by duty-engine.
 */
export const POST = sourced(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = (await ctx.params).id;
  const body = (await req.json().catch(() => null)) as { values?: unknown } | null;
  const values: unknown[] = Array.isArray(body?.values) ? body.values : [body];
  if (!values.length || values.length > 50 || !values.every(isPair)) return Response.json({ error: 'path and value are required' }, { status: 400 });
  const r = confirmFields(id, values);
  if (!r.ok) return Response.json({ error: r.error, path: r.path }, { status: r.status });
  return Response.json(noticeView(getNotice(id)!, confirmationsFor(id)));
});
