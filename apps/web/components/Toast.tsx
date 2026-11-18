'use client';

import { useEffect } from 'react';

export type ToastMessage = { id: number; text: string; detail?: string; persistent: boolean };

/**
 * DESIGN.md 4: bottom-centre (on phone, above the thumb bar), ink, radius md, overlay shadow, max 420px.
 * Auto-dismisses after 5s unless `persistent` (errors and "approval cleared" stay until dismissed).
 */
export function Toast({ message, onDismiss }: { message: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message || message.persistent) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(200px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6">
      {message ? (
        <div
          key={message.id}
          role="status"
          className="toast-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-md bg-ink py-2 pr-2 pl-4 text-white shadow-overlay"
        >
          <span aria-hidden="true" className="mt-3 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[12px] font-semibold">
            !
          </span>
          <p className="min-w-0 flex-1 py-2.5 text-caption text-white">
            <span className="block text-body font-medium">{message.text}</span>
            {message.detail ? <span className="mt-0.5 block text-white/72">{message.detail}</span> : null}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-11 shrink-0 items-center rounded-sm px-3 text-caption font-semibold text-white/80 transition-colors duration-120 hover:bg-white/10 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
