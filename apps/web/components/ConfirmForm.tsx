'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import type { Flag } from '../lib/assess';

/**
 * Flagged fields with what the reader saw, editable. Submitting confirms each value (as typed) on the server,
 * which re-checks the notice with duty-engine. Nothing is calculated from a flagged value before this.
 */
export function ConfirmForm({ noticeId, flags, title = 'Confirm values' }: { noticeId: string; flags: Flag[]; title?: string }) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError(null);
    const data = new FormData(form);
    // All or none: one bad value saves nothing.
    const res = await fetch(`/api/notices/${noticeId}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values: flags.map((f) => ({ path: f.path, value: String(data.get(f.path) ?? '') })) }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
      const label = flags.find((f) => f.path === body.path)?.label;
      const msg = body.error === 'not_flagged' ? 'This was already confirmed. Reload the page.' : (body.error ?? 'Could not be saved.');
      setError(label ? `${label}: ${msg}` : msg);
      return;
    }
    router.refresh();
  }

  return (
    <form
      aria-label={title}
      className="rounded-md bg-confirm-bg/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <p className="text-body font-medium text-ink">
        <span aria-hidden="true" className="mr-1.5 text-confirm-fg">
          ◐
        </span>
        Check {flags.length === 1 ? 'this value' : `these ${flags.length} values`} against the notice
      </p>
      <p className="mt-1 text-caption text-text-muted">The reader was not sure. Nothing is calculated from them until you confirm.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {flags.map((f) => (
          <label key={f.path} htmlFor={`${id}-${f.path}`} className="block">
            <span className="text-label uppercase text-text-muted">{f.label}</span>
            <input
              id={`${id}-${f.path}`}
              name={f.path}
              defaultValue={f.read ?? ''}
              autoComplete="off"
              className="mt-1 block h-11 w-full rounded-sm bg-surface px-3 font-mono text-mono text-ink shadow-float outline-none focus-visible:outline-2 focus-visible:outline-accent"
            />
            <span className="mt-1 block text-caption text-text-muted">Read from {f.source}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-caption text-ink">
          <span aria-hidden="true" className="mr-1 font-semibold text-haunt-fg">
            !
          </span>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-surface px-5 text-body font-medium text-ink shadow-float transition duration-120 ease-out hover:shadow-raised active:scale-[.98] disabled:opacity-60"
      >
        {busy ? 'Checking…' : title}
      </button>
    </form>
  );
}
