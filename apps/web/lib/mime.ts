/** Just enough RFC 5322 / MIME to pull the To address and the attachments out of a forwarded .eml. */

export type MailPart = { filename: string; bytes: Uint8Array };

type Headers = Map<string, string>;

function split(raw: string): { headers: Headers; body: string } {
  const at = raw.search(/\r?\n\r?\n/);
  const head = at < 0 ? raw : raw.slice(0, at);
  const body = at < 0 ? '' : raw.slice(at).replace(/^\r?\n\r?\n/, '');
  const headers: Headers = new Map();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
  }
  return { headers, body };
}

const param = (header: string | undefined, name: string) =>
  header ? new RegExp(`${name}\\*?=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i').exec(header)?.slice(1).find((x) => x !== undefined) : undefined;

function decode(body: string, encoding: string | undefined): Uint8Array {
  if (encoding?.toLowerCase() === 'base64') return new Uint8Array(Buffer.from(body.replace(/\s+/g, ''), 'base64'));
  return new Uint8Array(Buffer.from(body, 'latin1'));
}

function walk(raw: string, out: MailPart[], depth: number): void {
  if (depth > 5) return;
  const { headers, body } = split(raw);
  const type = headers.get('content-type') ?? 'text/plain';
  const boundary = param(type, 'boundary');
  if (/^multipart\//i.test(type) && boundary) {
    const parts = body.split(`--${boundary}`).slice(1);
    for (const p of parts) {
      if (p.startsWith('--')) break;
      walk(p.replace(/^\r?\n/, ''), out, depth + 1);
    }
    return;
  }
  if (/^message\/rfc822/i.test(type)) return walk(body, out, depth + 1);
  const disposition = headers.get('content-disposition');
  const filename = param(disposition, 'filename') ?? param(type, 'name');
  if (filename || /^attachment/i.test(disposition ?? '')) {
    out.push({ filename: filename ?? 'attachment', bytes: decode(body, headers.get('content-transfer-encoding')) });
  }
}

/** The To header and every attachment, including those inside a forwarded message. */
export function parseEml(raw: string): { to: string; attachments: MailPart[] } {
  const attachments: MailPart[] = [];
  walk(raw, attachments, 0);
  return { to: split(raw).headers.get('to') ?? '', attachments };
}
