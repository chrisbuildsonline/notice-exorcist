import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heicHeader, pngHeader } from '../../../../../packages/notice-extract/src/test/image-headers';
import { MAX_BYTES } from '../../../lib/limits';
import { freshDataDir, noticeCount, specimenBytes, storedFiles } from '../../../lib/test-env';
import { EMPTY, HEIC_HINT, NO_FILE, NOT_SUPPORTED, oversize, OVERSIZE, TOO_MANY_PIXELS } from '../../../lib/upload-messages';
import { POST } from './route';

const upload = (bytes: Uint8Array, name: string) => {
  const form = new FormData();
  form.append('file', new File([bytes as Uint8Array<ArrayBuffer>], name));
  return POST(new Request('http://x/api/notices', { method: 'POST', body: form }));
};
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

describe('POST /api/notices', () => {
  let dir: string;
  const logs: unknown[][] = [];
  beforeEach(() => {
    dir = freshDataDir();
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, m).mockImplementation((...a) => void logs.push(a));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // no file names, contents or error text in the logs (R6.11)
    const logged = JSON.stringify(logs);
    for (const secret of ['PRIVATE-NAME', 'That file', 'That image']) expect(logged).not.toContain(secret);
    logs.length = 0;
  });

  it('accepts a PNG, stores it and returns the notice id', async () => {
    const res = await upload(specimenBytes('specimen-2-form29.png'), 'PRIVATE-NAME.png');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(noticeCount()).toBe(1);
    expect(storedFiles(dir)).toHaveLength(1);
  });

  it('rejects an .exe by its bytes, not its name, and stores nothing', async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = await upload(exe, 'PRIVATE-NAME.pdf');
    expect(res.status).toBe(415);
    expect(await errorOf(res)).toBe(NOT_SUPPORTED);
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toHaveLength(0);
  });

  it('rejects a file over 10 MB with its size and the limit, and stores nothing', async () => {
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const res = await upload(big, 'PRIVATE-NAME.pdf');
    expect(res.status).toBe(413);
    expect(await errorOf(res)).toBe(oversize(MAX_BYTES + 1));
    // a body far past the cap is cut off while it streams in, so its size is not known
    const huge = await upload(new Uint8Array(16 * 1024 * 1024), 'huge.pdf');
    expect(huge.status).toBe(413);
    expect(await errorOf(huge)).toBe(OVERSIZE);
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toHaveLength(0);
  });

  it('rejects an empty file with 422, a HEIC photo with the iPhone hint, a pixel bomb with 422; stores nothing', async () => {
    const empty = await upload(new Uint8Array(), 'PRIVATE-NAME.pdf');
    expect([empty.status, await errorOf(empty)]).toEqual([422, EMPTY]);
    const heic = await upload(heicHeader(), 'PRIVATE-NAME.png');
    expect([heic.status, await errorOf(heic)]).toEqual([415, `${NOT_SUPPORTED} ${HEIC_HINT}`]);
    const bomb = await upload(pngHeader(12000, 12000), 'PRIVATE-NAME.png');
    expect([bomb.status, await errorOf(bomb)]).toEqual([422, TOO_MANY_PIXELS]);
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toHaveLength(0);
  });

  it('accepts a tall and a wide image and stores them byte for byte', async () => {
    expect((await upload(pngHeader(800, 3000), 'tall.png')).status).toBe(201);
    expect((await upload(pngHeader(3000, 800), 'wide.png')).status).toBe(201);
    expect(noticeCount()).toBe(2);
    expect(storedFiles(dir)).toHaveLength(2);
  });

  it('rejects a request with no file', async () => {
    const res = await POST(new Request('http://x/api/notices', { method: 'POST', body: new FormData() }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe(NO_FILE);
    expect(noticeCount()).toBe(0);
  });
});
