import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MAX_BYTES } from '../lib/limits';
import { NOT_SUPPORTED, OFFLINE, oversize, UPLOAD_FAILED } from '../lib/upload-messages';
import { DropzoneView, ERROR_ID, FILE_INPUT_ID, sendNotice } from './Dropzone';

const file = (size: number, name = 'notice.pdf') => {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('sendNotice (R6.1, R6.2)', () => {
  it('a file over 10 MB never reaches the network and gets the size and the limit', async () => {
    const post = vi.fn(reply(201, { id: 'x' }));
    const r = await sendNotice(file(MAX_BYTES + 3 * 1024 * 1024), post);
    expect(post).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, error: oversize(MAX_BYTES + 3 * 1024 * 1024) });
    expect(!r.ok && r.error).toContain('This one is 13.0 MB; the limit is 10.0 MB.');
  });

  it('a file within the limit is posted as the `file` field', async () => {
    const post = vi.fn(reply(201, { id: 'x' }));
    expect(await sendNotice(file(MAX_BYTES), post)).toEqual({ ok: true });
    expect(post).toHaveBeenCalledOnce();
    expect((post.mock.calls[0] as unknown as [FormData])[0].get('file')).toBeInstanceOf(File);
  });

  it('shows the server error body as is, or a plain fallback', async () => {
    expect(await sendNotice(file(10), reply(415, { error: NOT_SUPPORTED }))).toEqual({ ok: false, error: NOT_SUPPORTED });
    expect(await sendNotice(file(10), async () => new Response('<html>', { status: 500 }))).toEqual({ ok: false, error: UPLOAD_FAILED });
    expect(await sendNotice(file(10), async () => Promise.reject(new TypeError('offline')))).toEqual({ ok: false, error: OFFLINE });
  });
});

describe('DropzoneView: the error region (R6.9)', () => {
  const input = (html: string) => /<input[^>]*id="notice-file"[^>]*>/.exec(html)?.[0] ?? '';

  it('with an error: role=alert beside the dropzone, the input aria-invalid and described by it', () => {
    const html = renderToStaticMarkup(<DropzoneView busy={false} over={false} error={NOT_SUPPORTED} handlers={{}} />);
    expect(html).toMatch(new RegExp(`<p[^>]*role="alert"[^>]*id="${ERROR_ID}"|<p[^>]*id="${ERROR_ID}"[^>]*role="alert"`));
    expect(html).toContain(`<span>${NOT_SUPPORTED}</span></p>`);
    expect(input(html)).toContain('aria-invalid="true"');
    expect(input(html)).toContain(`aria-describedby="${ERROR_ID}"`);
    expect(FILE_INPUT_ID).toBe('notice-file');
  });

  it('with no error (the next attempt clears it): no alert text, no aria-invalid, no describedby', () => {
    const html = renderToStaticMarkup(<DropzoneView busy over={false} error={null} handlers={{}} />);
    expect(html).not.toContain('role="alert"');
    expect(input(html)).not.toContain('aria-invalid');
    expect(input(html)).not.toContain('aria-describedby');
    expect(html).toContain('Uploading…');
  });
});
