import type { ReactNode } from 'react';
import { Fog } from './Fog';

/** The notice drawn as a document: a surface card with the fog behind its rows, radiating its aura (DESIGN.md 3.1). */
export function Paper({ fog, aura = null, label, children }: { fog: number; aura?: 'haunt' | 'unverified' | null; label: string; children: ReactNode }) {
  return (
    <section aria-label={label} data-aura={aura ?? undefined} className="paper relative isolate rounded-lg bg-surface p-4 shadow-float md:p-8">
      <Fog opacity={fog} />
      {children}
    </section>
  );
}
