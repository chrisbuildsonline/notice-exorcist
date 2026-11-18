'use client';

import { Fragment, type KeyboardEvent, type ReactNode, useState } from 'react';
import { checkParagraph, type DraftView, segments } from '../lib/draft';
import { Figure, type FigureProv } from './Figure';

/** The paragraph as text: text nodes as typed, each token element back to its `{{…}}` token, line breaks as spaces. */
function readBlock(el: HTMLElement): string {
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (!(n instanceof HTMLElement)) return '';
    if (n.dataset.token) return `{{${n.dataset.token}}}`;
    if (n.tagName === 'BR') return ' ';
    return [...n.childNodes].map(walk).join('');
  };
  return [...el.childNodes].map(walk).join('').replace(/[\s ]+/g, ' ').trim();
}

type Status = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'failed' };

const STATUS_TEXT = { idle: 'Edits save when you leave a paragraph', saving: 'Saving…', saved: 'Saved', failed: 'Not saved' } as const;

/**
 * The reply draft on paper. `onEdit` fires on every keystroke in a block, before anything is saved.
 * Each paragraph is a plain-text block. Figures are `<Figure>` tokens bound to their
 * provenance record and citations are chips; both are atomic, so only the words around them can be edited.
 * A typed amount is refused before anything is sent, and the server checks the same rule.
 * `after` puts a node (the toast) right after one paragraph in the DOM, so it is the next Tab stop there.
 */
export function DraftEditor({
  draft,
  onSaved,
  onEdit,
  after,
}: {
  draft: DraftView;
  onSaved?: (v: DraftView, i: number) => void;
  onEdit?: (i: number) => void;
  after?: { index: number; node: ReactNode };
}) {
  const [paras, setParas] = useState(draft.paragraphs);
  // Bumped to redraw a block from state (after a save, or to undo an edit the editor refused).
  const [versions, setVersions] = useState<number[]>(() => draft.paragraphs.map(() => 0));
  const [errors, setErrors] = useState<Array<string | null>>(() => draft.paragraphs.map(() => null));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const figures = new Map(draft.figures.map((f) => [f.id, f]));
  const number = new Map(draft.citations.map((c, n) => [c.id, n + 1]));

  const setError = (i: number, e: string | null) => setErrors((all) => all.map((x, j) => (j === i ? e : x)));
  const redraw = (i: number) => setVersions((all) => all.map((x, j) => (j === i ? x + 1 : x)));

  async function commit(i: number, el: HTMLElement) {
    const next = readBlock(el);
    if (next === paras[i]) return setError(i, null);
    const refused = checkParagraph(paras[i]!, next);
    if (refused) return setError(i, refused);
    setError(i, null);
    setStatus({ kind: 'saving' });
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paragraphs: paras.map((p, j) => (j === i ? next : p)) }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { message?: string } | null;
      setError(i, body?.message ?? 'The draft could not be saved. Try again.');
      return setStatus({ kind: 'failed' });
    }
    const view = (await res.json()) as DraftView;
    setParas(view.paragraphs);
    redraw(i);
    setStatus({ kind: 'saved' });
    onSaved?.(view, i);
  }

  function onKey(i: number, e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setError(i, null);
      redraw(i);
    }
  }

  return (
    <section aria-label="Reply draft" data-draft-id={draft.id} className="rounded-lg bg-surface p-5 shadow-float md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-label uppercase text-text-muted">Reply draft</p>
        <p data-testid="save-status" aria-live="polite" className="text-caption text-text-muted">
          {STATUS_TEXT[status.kind]}
        </p>
      </div>

      <div className="mt-5 space-y-1 md:mt-6">
        {paras.map((p, i) => {
          const err = errors[i];
          return (
            <Fragment key={i}>
            <div key={versions[i]} className="group relative">
              <div
                data-testid="draft-block"
                role="textbox"
                aria-label={`Paragraph ${i + 1}`}
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? `draft-error-${i}` : undefined}
                contentEditable="plaintext-only"
                suppressContentEditableWarning
                spellCheck
                onInput={() => onEdit?.(i)}
                // Tab onto the block's own citation chip has not left the paragraph: saving then would redraw the block
                // and drop focus from the chip to the page.
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) void commit(i, e.currentTarget);
                }}
                onKeyDown={(e) => onKey(i, e)}
                className={`-mx-3 cursor-text rounded-sm px-3 py-2.5 pr-9 text-body text-ink transition-colors duration-120 hover:bg-surface-muted focus:bg-surface-muted max-md:text-[16px] ${err ? 'bg-haunt-bg hover:bg-haunt-bg focus:bg-haunt-bg' : ''}`}
              >
                {segments(p).map((s, k) => {
                  if (s.t === 'text') return s.s;
                  if (s.t === 'fig') {
                    const f = figures.get(s.id);
                    return (
                      <span key={k} data-token={`fig:${s.id}`} contentEditable={false} className="mx-0.5 inline-block">
                        {/* An unknown id has no record: Figure renders it as unsourced (and throws in dev and test). */}
                        <Figure value={f?.value ?? '0'} prov={f?.prov ?? ('' as FigureProv)} source={f?.source ?? ''} />
                      </span>
                    );
                  }
                  return (
                    <a
                      key={k}
                      data-token={`cite:${s.id}`}
                      contentEditable={false}
                      href={`#source-${s.id}`}
                      aria-label={`Source ${number.get(s.id) ?? '?'}`}
                      className="mx-0.5 inline-flex h-5 items-center rounded-xs bg-accent-50 px-1 align-[1px] font-mono text-[12px] leading-5 font-semibold text-accent no-underline hover:text-accent-700"
                    >
                      {`[${number.get(s.id) ?? '?'}]`}
                    </a>
                  );
                })}
              </div>
              <span aria-hidden="true" className="pointer-events-none absolute top-2.5 right-0 text-body text-text-muted opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-focus-within:opacity-100">
                ✎
              </span>
              {err ? (
                <div id={`draft-error-${i}`} role="alert" className="mt-1 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-haunt-bg px-2.5 text-[12px] leading-4 font-semibold text-haunt-fg">
                    <span aria-hidden="true">!</span>Not saved
                  </span>
                  <span className="text-caption text-text-secondary">{err}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(i, null);
                      redraw(i);
                    }}
                    className="inline-flex h-11 items-center rounded-full px-3 text-caption font-semibold text-accent hover:bg-surface-muted hover:text-accent-700"
                  >
                    Undo my edit
                  </button>
                </div>
              ) : null}
            </div>
            {after?.index === i ? after.node : null}
            </Fragment>
          );
        })}
      </div>

      <section aria-labelledby="draft-sources" className="mt-8 border-t border-line pt-6 md:mt-10">
        <h2 id="draft-sources" className="text-label uppercase text-text-muted">
          Sources
        </h2>
        <ol className="mt-3 space-y-1">
          {draft.citations.map((c, n) => (
            // the whole row (44px at least) is the link's tap target
            <li key={c.id} id={`source-${c.id}`} className="relative -mx-2 flex min-h-11 scroll-mt-24 items-center gap-3 rounded-sm px-2 py-1.5 text-caption text-text-secondary target:bg-accent-50">
              <span className="shrink-0 font-mono font-semibold text-accent">{`[${n + 1}]`}</span>
              {c.href ? (
                <a href={c.href} target="_blank" rel="noreferrer" className="min-w-0 text-text-secondary underline-offset-2 after:absolute after:inset-0 after:rounded-sm after:content-[''] hover:text-accent hover:underline">
                  {c.label} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="min-w-0">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-caption text-text-muted">Not legal advice. Draft only, never filed.</p>
      </section>
    </section>
  );
}
