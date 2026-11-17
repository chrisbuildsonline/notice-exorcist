'use client';

import { useRouter } from 'next/navigation';
import { type DragEvent, useState } from 'react';

export const FILE_INPUT_ID = 'notice-file';
const ACCEPT = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';

/** Drop or pick a PDF or photo; on phones a second input opens the camera. The server checks type and size. */
export function Dropzone() {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch('/api/notices', { method: 'POST', body });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Upload failed. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void send(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-[1.5px] px-4 text-center transition-colors duration-120 focus-within:outline-2 focus-within:outline-accent ${
          over ? 'border-solid border-accent bg-accent-50' : 'border-dashed border-[#c9cdd6] bg-surface-muted'
        }`}
      >
        <input
          id={FILE_INPUT_ID}
          name="file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void send(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="mb-2 text-text-secondary" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
        </svg>
        <span className="text-body font-medium">{busy ? 'Uploading…' : 'Drop a PDF or photo'}</span>
        <span className="text-caption text-text-muted">
          or <span className="text-accent underline-offset-2 hover:underline">browse</span> · up to 10 MB
        </span>
      </label>
      <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface text-body font-medium text-text-secondary shadow-float focus-within:outline-2 focus-within:outline-accent md:hidden">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void send(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        Take a photo
      </label>
      {error ? (
        <p role="alert" className="mt-3 text-caption text-haunt-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
