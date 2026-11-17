import type { ReactNode } from 'react';
import { Fog } from './Fog';

/** The notice drawn as a document: a surface card with the fog behind its rows. */
export function Paper({ fog, label, children }: { fog: number; label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="relative isolate rounded-lg bg-surface p-4 shadow-float md:p-8">
      <Fog opacity={fog} />
      {children}
    </section>
  );
}
