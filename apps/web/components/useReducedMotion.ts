'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * True when the user asked for reduced motion; follows the setting live (R3.7). CSS covers every animation in the
 * app; any JS that moves things (rAF, Web Animations, smooth scrolling) must branch on this instead of bypassing it.
 * The server renders as if motion is reduced, so nothing starts moving before the client knows.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => true);
}
