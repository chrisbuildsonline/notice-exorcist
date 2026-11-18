import type { KeyboardEvent } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Tab and Shift+Tab wrap inside an open modal `dialog`. A key from a dialog nested inside it (the calculation drawer
 * inside the tablet line drawer) is left to that dialog.
 */
export function trapTab(e: KeyboardEvent<HTMLDialogElement>, dialog: HTMLDialogElement | null) {
  if (e.key !== 'Tab' || !dialog || e.defaultPrevented) return;
  if (e.target instanceof Element && e.target.closest('dialog') !== dialog) return;
  const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 && el.closest('dialog') === dialog);
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !dialog.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}
