'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * After a client navigation, focus the new page's `h1` so a screen reader announces the title and focus is not
 * left on a link that no longer exists. A first load leaves focus alone. A `?line=` change is not a new page.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h1 = document.querySelector<HTMLElement>('main h1');
    // on a phone line view the title is hidden; the landmark is the next best target
    const target = h1?.checkVisibility() ? h1 : document.getElementById('main');
    target?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
