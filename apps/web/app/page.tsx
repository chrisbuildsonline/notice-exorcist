import { GhostGlyph } from '../components/GhostGlyph';

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 md:px-8">
      <header className="flex h-16 items-center">
        <span className="flex items-center gap-2 text-body font-semibold tracking-tight">
          <GhostGlyph size={24} />
          Notice Exorcist
        </span>
      </header>

      <main>
        <div className="pt-4 md:pt-6">
          <h1 className="text-title">Inbox</h1>
          <p className="mt-2 text-caption text-text-muted">No notices yet</p>
        </div>

        <section aria-labelledby="notices-label" className="mt-8 rounded-lg bg-surface p-5 shadow-float md:mt-12 md:p-6">
          <p id="notices-label" className="text-label uppercase text-text-muted">
            Notices
          </p>

          <div className="flex flex-col items-center px-2 py-12 text-center md:py-20">
            <GhostGlyph />
            <h2 className="mt-6 text-heading">Exorcise your customs notice</h2>
            <p className="mt-2 max-w-md text-body text-text-secondary">
              Forward or upload a CBP Form 28, 29 or courier duty invoice. We check every figure and draft a cited
              reply you approve.
            </p>
            <a
              href="#"
              className="mt-8 inline-flex h-14 items-center rounded-full bg-ink px-6 text-body font-medium text-white shadow-pill transition duration-120 ease-out hover:-translate-y-px hover:bg-ink-hover active:scale-[.98] md:h-13"
            >
              Try a specimen
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
