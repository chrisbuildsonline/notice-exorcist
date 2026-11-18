'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { trapTab } from './trapTab';

const TABLET = '(min-width: 768px) and (max-width: 1023px)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(TABLET);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** True from 768 to 1023 px; follows resizing. The server renders the in-flow panel, which CSS hides at that width. */
const useTablet = () => useSyncExternalStore(subscribe, () => window.matchMedia(TABLET).matches, () => false);

/**
 * The line panel's wrapper. At 1024 and up it is the sticky 5/12 column, and under 768 the full-screen line view
 * (both in flow, styled by the panel itself). From 768 to 1023, a chosen line opens the same panel as a right drawer:
 * a modal dialog sharing the calculation drawer's look and motion, with a focus trap, Esc and scrim click to close,
 * and focus back on the line that opened it.
 */
export function SidePanelDrawer({ open, lineHref, closeHref, children }: { open: boolean; lineHref: string; closeHref: string; children: ReactNode }) {
  const tablet = useTablet();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, [tablet, open]);

  if (!tablet) return <div className="contents md:max-lg:hidden">{children}</div>;
  if (!open) return null;

  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      aria-label="Line details"
      onKeyDown={(e) => trapTab(e, dialog.current)}
      onClose={(e) => {
        if (e.target !== e.currentTarget) return; // the calculation drawer inside it closed
        document.querySelector<HTMLElement>(`a[href="${lineHref}"]`)?.focus();
        router.replace(closeHref, { scroll: false });
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="calc-drawer m-0 h-dvh max-h-none w-full max-w-none flex-row justify-end border-0 bg-transparent p-0 open:flex"
    >
      <div
        data-testid="side-panel"
        className="calc-panel side-panel relative h-full w-[560px] overflow-y-auto overscroll-contain rounded-l-xl bg-surface shadow-overlay [&>aside]:rounded-none [&>aside]:p-8 [&>aside]:pt-6 [&>aside]:shadow-none"
      >
        <div className="sticky top-0 z-10 flex justify-end bg-surface px-4 pt-4">
          <button
            type="button"
            aria-label="Close line details"
            onClick={close}
            className="inline-flex size-11 items-center justify-center rounded-full text-[20px] text-text-secondary transition-colors duration-120 hover:bg-surface-muted"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
