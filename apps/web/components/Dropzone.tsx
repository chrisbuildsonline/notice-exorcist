'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type DragEvent, useState } from 'react';
import { MAX_BYTES } from '../lib/limits';
import { OFFLINE, oversize, UPLOAD_FAILED } from '../lib/upload-messages';

export const FILE_INPUT_ID = 'notice-file';
export const ERROR_ID = 'upload-error';
const ACCEPT = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';
// The inputs are visually hidden, so the label wearing them shows the keyboard focus ring (not on a pointer press).
const RING = 'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';

type Post = (body: FormData) => Promise<Response>;
const postNotice: Post = (body) => fetch('/api/notices', { method: 'POST', body });

/**
 * Sends one file. A file whose size is known to be over 10 MB is refused here, before any upload;
 * the server check stays the authority for everything else (type, emptiness, pixels).
 */
export async function sendNotice(file: File, post: Post = postNotice): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES) return { ok: false, error: oversize(file.size) };
  const body = new FormData();
  body.append('file', file);
  try {
    const res = await post(body);
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    return { ok: false, error: typeof j.error === 'string' ? j.error : UPLOAD_FAILED };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

type Handlers = {
  onPick?: (e: ChangeEvent<HTMLInputElement>) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent) => void;
};

/** The dropzone markup. While an error shows, both inputs are `aria-invalid` and described by the alert. */
export function DropzoneView({ busy, over, error, handlers }: { busy: boolean; over: boolean; error: string | null; handlers: Handlers }) {
  const invalid = error ? { 'aria-invalid': true, 'aria-describedby': ERROR_ID } : {};
  const edge = over ? 'border-solid border-accent bg-accent-50' : error ? 'border-dashed border-haunt-edge bg-surface-muted' : 'border-dashed border-[#c9cdd6] bg-surface-muted';
  return (
    <div>
      <label
        onDragOver={handlers.onDragOver}
        onDragLeave={handlers.onDragLeave}
        onDrop={handlers.onDrop}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-[1.5px] px-4 text-center transition-colors duration-120 ${RING} ${edge}`}
      >
        <input id={FILE_INPUT_ID} name="file" type="file" accept={ACCEPT} className="sr-only" onChange={handlers.onPick} {...invalid} />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="mb-2 text-text-secondary" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
        </svg>
        <span className="text-body font-medium">{busy ? 'Uploading…' : 'Drop a PDF or photo'}</span>
        <span className="text-caption text-text-muted">
          or <span className="text-accent underline-offset-2 hover:underline">browse</span> · up to 10 MB
        </span>
      </label>
      <label className={`mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface text-body font-medium text-text-secondary shadow-float ${RING} md:hidden`}>
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlers.onPick} {...invalid} />
        Take a photo
      </label>
      {error ? (
        <p id={ERROR_ID} role="alert" data-testid="upload-error" className="mt-3 flex items-start gap-2 rounded-sm bg-haunt-bg px-3 py-2.5 text-caption text-haunt-fg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5v.01" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Drop or pick a PDF or photo; on phones a second input opens the camera. Errors show beside it; focus stays put. */
export function Dropzone() {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    const r = await sendNotice(file);
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error);
  }

  return (
    <DropzoneView
      busy={busy}
      over={over}
      error={error}
      handlers={{
        onPick: (e) => {
          void send(e.target.files?.[0]);
          e.target.value = '';
        },
        onDragOver: (e) => {
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e) => {
          e.preventDefault();
          setOver(false);
          void send(e.dataTransfer.files[0]);
        },
      }}
    />
  );
}
