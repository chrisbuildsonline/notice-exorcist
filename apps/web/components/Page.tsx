import type { ReactNode } from 'react';

/** The one `<main>` landmark of a page, and the skip link's target. It takes focus but is not a control, so no ring. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      {children}
    </main>
  );
}
