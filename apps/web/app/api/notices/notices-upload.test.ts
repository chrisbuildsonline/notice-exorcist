import { beforeEach, describe, expect, it } from 'vitest';
import { freshDataDir, noticeCount, specimenBytes, storedFiles } from '../../../lib/test-env';
import { POST } from './route';

const upload = (bytes: Uint8Array, name: string) => {
  const form = new FormData();
  form.append('file', new File([bytes as Uint8Array<ArrayBuffer>], name));
  return POST(new Request('http://x/api/notices', { method: 'POST', body: form }));
};

describe('POST /api/notices', () => {
  let dir: string;
  beforeEach(() => {
    dir = freshDataDir();
  });

  it('accepts a PNG, stores it and returns the notice id', async () => {
    const res = await upload(specimenBytes('specimen-2-form29.png'), 'notice.png');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(noticeCount()).toBe(1);
    expect(storedFiles(dir)).toHaveLength(1);
  });

  it('rejects an .exe by its bytes, not its name, and stores nothing', async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = await upload(exe, 'notice.pdf');
    expect(res.status).toBe(415);
    expect(((await res.json()) as { error: string }).error).toBe('That file is not a PDF, PNG or JPEG.');
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toHaveLength(0);
  });

  it('rejects a file over 10 MB and stores nothing', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const res = await upload(big, 'big.pdf');
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toBe('That file is over 10 MB.');
    // a body far past the cap is cut off while it streams in
    expect((await upload(new Uint8Array(16 * 1024 * 1024), 'huge.pdf')).status).toBe(413);
    expect(noticeCount()).toBe(0);
    expect(storedFiles(dir)).toHaveLength(0);
  });

  it('rejects a request with no file', async () => {
    const res = await POST(new Request('http://x/api/notices', { method: 'POST', body: new FormData() }));
    expect(res.status).toBe(400);
    expect(noticeCount()).toBe(0);
  });
});
