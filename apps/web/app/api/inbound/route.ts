import { createHash, timingSafeEqual } from 'node:crypto';
import { getDb } from '../../../lib/db';
import { bodyTooBig, checkFile, fileNotice } from '../../../lib/intake';
import { type MailPart, parseEml } from '../../../lib/mime';

export const dynamic = 'force-dynamic';

const MAX_ATTACHMENTS = 10;

/** Constant-time compare of the x-inbound-secret header with INBOUND_SECRET. No secret configured means no access. */
function authorized(req: Request): boolean {
  const want = process.env.INBOUND_SECRET;
  const got = req.headers.get('x-inbound-secret');
  if (!want || !got) return false;
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(want), h(got));
}

type Mail = { to: string; attachments: MailPart[] };

async function readMail(req: Request): Promise<Mail | null> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) {
    const form = await req.formData();
    const attachments: MailPart[] = [];
    for (const v of form.values()) if (v instanceof File) attachments.push({ filename: v.name, bytes: new Uint8Array(await v.arrayBuffer()) });
    return { to: String(form.get('to') ?? ''), attachments };
  }
  if (type.includes('application/json')) {
    const j = (await req.json()) as { to?: unknown; attachments?: Array<{ filename?: unknown; content?: unknown }> };
    const attachments = (Array.isArray(j.attachments) ? j.attachments : [])
      .filter((a) => typeof a?.content === 'string')
      .map((a) => ({ filename: typeof a.filename === 'string' ? a.filename : 'attachment', bytes: new Uint8Array(Buffer.from(a.content as string, 'base64')) }));
    return { to: typeof j.to === 'string' ? j.to : '', attachments };
  }
  // A raw forwarded email (.eml), sent as message/rfc822 or text/plain.
  return parseEml(Buffer.from(await req.arrayBuffer()).toString('latin1'));
}

const knownToken = (to: string) => {
  const token = /notices\+([A-Za-z0-9_-]+)@/i.exec(to)?.[1];
  return token !== undefined && getDb().prepare('SELECT 1 FROM inbox_tokens WHERE token = ?').get(token) !== undefined;
};

/**
 * A forwarded email from the mail provider's webhook. Files one notice per valid attachment.
 * Never replies or sends mail, and never logs the subject, body or attachments.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (bodyTooBig(req, MAX_ATTACHMENTS)) return Response.json({ error: 'too_large' }, { status: 413 });
  let mail: Mail | null;
  try {
    mail = await readMail(req);
  } catch {
    mail = null;
  }
  if (!mail) return Response.json({ error: 'unreadable' }, { status: 400 });
  if (!knownToken(mail.to)) return Response.json({ error: 'unknown_inbox' }, { status: 404 });
  const valid = mail.attachments.filter((a) => checkFile(a.bytes).ok).slice(0, MAX_ATTACHMENTS);
  if (valid.length === 0) return Response.json({ error: 'no_valid_attachment' }, { status: 422 });
  const ids = valid.map((a) => fileNotice({ bytes: a.bytes, filename: a.filename, source: 'email' }).id);
  return Response.json({ ids }, { status: 202 });
}
