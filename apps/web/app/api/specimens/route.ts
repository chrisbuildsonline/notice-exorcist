import { fileSpecimen } from '../../../lib/intake';

export const dynamic = 'force-dynamic';

/** "Try a specimen": files a bundled synthetic notice, read from its recording (no key, no model), then back to the inbox. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const id = form?.get('specimen');
  const filed = fileSpecimen(typeof id === 'string' && id ? id : undefined);
  if (!filed) return Response.json({ error: 'unknown_specimen' }, { status: 404 });
  await filed.settled;
  return new Response(null, { status: 303, headers: { location: '/' } });
}
