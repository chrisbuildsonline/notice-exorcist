import { rereadNotice } from '../../../../../lib/intake';

export const dynamic = 'force-dynamic';

/** "Try reading again" on a notice that could not be read. A form POST, so it works without JavaScript. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id;
  const r = rereadNotice(id);
  if (!r) return Response.json({ error: 'not_found' }, { status: 404 });
  if (r === 'not_failed') return Response.json({ error: 'not_failed' }, { status: 409 });
  return new Response(null, { status: 303, headers: { location: `/notices/${id}` } });
}
