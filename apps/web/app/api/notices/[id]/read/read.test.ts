import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { pngHeader } from '../../../../../../../packages/notice-extract/src/test/image-headers';
import { fileNotice, getNotice } from '../../../../../lib/intake';
import { freshDataDir, specimenBytes, storedFiles } from '../../../../../lib/test-env';
import { POST } from './route';

const retry = (id: string) => POST(new Request(`http://x/api/notices/${id}/read`, { method: 'POST' }), { params: Promise.resolve({ id }) });

describe('POST /api/notices/[id]/read: read a failed notice again (R6.7)', () => {
  let dir: string;
  beforeEach(() => {
    dir = freshDataDir();
  });

  it('re-reads the stored original, unchanged, and redirects back to the notice', async () => {
    const tall = pngHeader(800, 3000);
    const { id, settled } = fileNotice({ bytes: tall, filename: 'receipt.png', source: 'upload' });
    await settled;
    expect(getNotice(id)?.status).toBe('failed');
    const res = await retry(id);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/notices/${id}`);
    expect(['reading', 'failed']).toContain(getNotice(id)?.status);
    const [file] = storedFiles(dir);
    expect(new Uint8Array(readFileSync(join(dir, 'files', file!)))).toEqual(tall);
  });

  it('only a failed notice can be read again; unknown ids are 404', async () => {
    const { id, settled } = fileNotice({ bytes: specimenBytes('specimen-2-form29.png'), filename: 'n.png', source: 'specimen' });
    await settled;
    expect(getNotice(id)?.status).toBe('ready');
    expect((await retry(id)).status).toBe(409);
    expect(getNotice(id)?.status).toBe('ready');
    expect((await retry('nope')).status).toBe(404);
  });
});
