import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heicHeader, pngHeader } from '../../../../../packages/notice-extract/src/test/image-headers';
import { getNotice, listNotices } from '../../../lib/intake';
import { freshDataDir, noticeCount, specimenBytes, storedFiles } from '../../../lib/test-env';
import { POST } from './route';

const SECRET = 'test-inbound-secret';
const TO = 'notices+demo@in.noticeexorcist.app';
const SUBJECT = 'Fwd: CBP notice for entry 4501 PRIVATE-SUBJECT';
const TEXT = 'Please look at this PRIVATE-BODY';
const pdf = () => specimenBytes('specimen-2-form29.pdf');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

function multipart(opts: { to?: string; files?: Array<[Uint8Array, string]> } = {}) {
  const form = new FormData();
  form.append('to', opts.to ?? TO);
  form.append('from', 'broker@example.com');
  form.append('subject', SUBJECT);
  form.append('text', TEXT);
  for (const [bytes, name] of opts.files ?? [[pdf(), 'notice.pdf']]) form.append('attachment-1', new File([bytes as Uint8Array<ArrayBuffer>], name));
  return form;
}

const post = (body: BodyInit, headers: Record<string, string> = { 'x-inbound-secret': SECRET }) =>
  POST(new Request('http://x/api/inbound', { method: 'POST', body, headers }));

/** A forwarded email as raw MIME: the CBP notice sits inside the forwarded message/rfc822 part. */
function eml(attachment: Uint8Array) {
  const wrap = (s: string) => s.replace(/.{1,76}/g, '$&\r\n');
  return [
    'From: Broker <broker@example.com>',
    `To: "Notice inbox" <${TO}>`,
    `Subject: ${SUBJECT}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="outer"',
    '',
    '--outer',
    'Content-Type: text/plain; charset=utf-8',
    '',
    TEXT,
    '--outer',
    'Content-Type: message/rfc822',
    '',
    'From: CBP <noreply@cbp.example>',
    'Subject: Notice of Action',
    'Content-Type: multipart/mixed;',
    '\tboundary=inner',
    '',
    '--inner',
    'Content-Type: text/plain',
    '',
    'Attached.',
    '--inner',
    'Content-Type: application/pdf; name="form29.pdf"',
    'Content-Disposition: attachment; filename="form29.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(attachment)),
    '--inner--',
    '--outer--',
    '',
  ].join('\r\n');
}

describe('POST /api/inbound', () => {
  let dir: string;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const logs: unknown[][] = [];

  beforeEach(() => {
    dir = freshDataDir();
    process.env.INBOUND_SECRET = SECRET;
    process.env.INBOX_TOKEN = 'demo';
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, m).mockImplementation((...a) => void logs.push(a));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // nothing sent anywhere, and no subject, body or attachment bytes in the logs
    expect(fetchSpy).not.toHaveBeenCalled();
    const logged = JSON.stringify(logs);
    for (const secret of ['PRIVATE-SUBJECT', 'PRIVATE-BODY', b64(pdf()).slice(0, 40)]) expect(logged).not.toContain(secret);
    logs.length = 0;
  });

  it('401 with no secret or a wrong one, and stores nothing', async () => {
    expect((await post(multipart(), {})).status).toBe(401);
    expect((await post(multipart(), { 'x-inbound-secret': 'wrong' })).status).toBe(401);
    expect((await post(multipart(), { 'x-inbound-secret': `${SECRET}x` })).status).toBe(401);
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toEqual([]);
  });

  it('401 when no secret is configured at all', async () => {
    delete process.env.INBOUND_SECRET;
    expect((await post(multipart(), { 'x-inbound-secret': '' })).status).toBe(401);
    expect(noticeCount()).toBe(0);
  });

  it('404 for an unknown inbox token', async () => {
    expect((await post(multipart({ to: 'notices+nobody@in.noticeexorcist.app' }))).status).toBe(404);
    expect((await post(multipart({ to: 'someone@example.com' }))).status).toBe(404);
    expect(noticeCount()).toBe(0);
  });

  it('422 when no attachment is a PDF, PNG or JPEG within the size limit', async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect((await post(multipart({ files: [[exe, 'notice.pdf']] }))).status).toBe(422);
    expect((await post(multipart({ files: [] }))).status).toBe(422);
    expect(noticeCount()).toBe(0);
  });

  it('202 for a multipart webhook: one notice per valid attachment, invalid ones skipped', async () => {
    const res = await post(multipart({ files: [[pdf(), 'a.pdf'], [new Uint8Array([1, 2, 3]), 'b.txt'], [specimenBytes('specimen-2-form29.png'), 'c.png']] }));
    expect(res.status).toBe(202);
    const { ids } = (await res.json()) as { ids: string[] };
    expect(ids).toHaveLength(2);
    expect(listNotices().map((n) => n.source)).toEqual(['email', 'email']);
  });

  it('uses the upload check: empty, HEIC and pixel-bomb attachments are skipped, a tall image is filed', async () => {
    const bad: Array<[Uint8Array, string]> = [[new Uint8Array(), 'empty.pdf'], [heicHeader(), 'IMG_0001.heic'], [pngHeader(12000, 12000), 'bomb.png']];
    expect((await post(multipart({ files: bad }))).status).toBe(422);
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toEqual([]);
    const res = await post(multipart({ files: [...bad, [pngHeader(800, 3000), 'receipt.png']] }));
    expect(res.status).toBe(202);
    expect(((await res.json()) as { ids: string[] }).ids).toHaveLength(1);
    expect(listNotices().map((n) => n.filename)).toEqual(['receipt.png']);
    expect(storedFiles(dir)).toHaveLength(1);
  });

  it('202 for JSON with a base64 attachment', async () => {
    const body = JSON.stringify({ to: TO, subject: SUBJECT, text: TEXT, attachments: [{ filename: 'form29.pdf', contentType: 'application/pdf', content: b64(pdf()) }] });
    const res = await post(body, { 'x-inbound-secret': SECRET, 'content-type': 'application/json' });
    expect(res.status).toBe(202);
    expect(((await res.json()) as { ids: string[] }).ids).toHaveLength(1);
  });

  it('a forwarded specimen .eml lands in the inbox and is read by the engine', async () => {
    const res = await post(eml(pdf()), { 'x-inbound-secret': SECRET, 'content-type': 'message/rfc822' });
    expect(res.status).toBe(202);
    const { ids } = (await res.json()) as { ids: string[] };
    expect(ids).toHaveLength(1);
    await vi.waitFor(() => expect(getNotice(ids[0]!)?.status).toBe('ready'));
    expect(getNotice(ids[0]!)).toMatchObject({ kind: 'cbp_form_29', source: 'email', filename: 'form29.pdf' });
  });
});
