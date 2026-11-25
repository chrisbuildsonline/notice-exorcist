'use client';

import { useCallback, useRef, useState } from 'react';
import type { DraftView } from '../lib/draft';
import { ApprovalCard, ApprovalCheck, ExportPill } from './ApprovalCard';
import type { Skipped } from '../lib/draft-builder';
import { DraftEditor } from './DraftEditor';
import { Haunt } from './Haunt';
import { SkippedNote } from './SkippedNote';
import { StatusPill } from './StatusPill';
import { Toast, type ToastMessage } from './Toast';

const CLEARED = { text: 'Approval cleared', detail: 'You edited the draft. Read it again and tick the box to approve the new text.', persistent: true };

/** The filename the server names in Content-Disposition. */
const filenameOf = (res: Response) => /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'notice-reply.pdf';

/**
 * The Exorcise screen below the back link: the title and draft state with the one primary pill (`Export PDF`),
 * the draft on paper, and the approval card. On phone the checkbox row and the pill move to a sticky bottom stack.
 *
 * Approval comes from the server: the page loads it from the stored record and only a tick that the server
 * accepts for the current full hash sets it. Any keystroke in the draft clears it, here and on the server.
 */
export function DraftWorkspace({ initial, subtitle, skipped = [] }: { initial: DraftView; subtitle: string; skipped?: Skipped[] }) {
  const [draft, setDraft] = useState(initial);
  const [ticking, setTicking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  // Bumped when the server accepts an approval: each one sends out the exorcism ring once (DESIGN.md 3.1).
  const [exorcisms, setExorcisms] = useState(0);
  // The paragraph an edit toast follows in the DOM, so its Dismiss is the next Tab stop from there; else it is last.
  const [toastAt, setToastAt] = useState<number | null>(null);
  // Bumped by every edit and every untick, so an approval answered after one is not applied.
  const generation = useRef(0);
  const approved = draft.state === 'approved' && !ticking;
  // What the screen shows now, for callbacks that finish after a later render (a save, an approval).
  const shown = useRef({ approvedOrTicking: false });
  shown.current.approvedOrTicking = draft.state === 'approved' || ticking;

  const say = (m: Omit<ToastMessage, 'id'>, at: number | null = null) => {
    setToastAt(at);
    setToast({ ...m, id: Date.now() });
  };
  const dismiss = useCallback(() => {
    // Dismissed from the keyboard: back to the paragraph being edited, not to the top of the page.
    if (toastAt !== null && document.activeElement?.closest('[role=status]'))
      document.querySelector<HTMLElement>(`[role=textbox][aria-label="Paragraph ${toastAt + 1}"]`)?.focus();
    setToast(null);
  }, [toastAt]);

  function withdraw() {
    generation.current += 1;
    setTicking(false);
    setDraft((d) => ({ ...d, state: 'draft' }));
    void fetch(`/api/drafts/${draft.id}/approve`, { method: 'DELETE' }).catch(() => null);
  }

  async function approve() {
    const at = ++generation.current;
    setTicking(true);
    const res = await fetch(`/api/drafts/${draft.id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash: draft.hash }),
    }).catch(() => null);
    // Read the body before clearing `ticking`: clearing it first rendered the box unticked until the body arrived.
    const approved = res?.ok ? ((await res.json().catch(() => null)) as DraftView | null) : null;
    if (at !== generation.current) return; // edited or unticked meanwhile: that already withdrew it
    setTicking(false);
    if (approved) {
      setExorcisms((n) => n + 1);
      return setDraft(approved);
    }
    if (res?.status === 409) {
      const now = await fetch(`/api/drafts/${draft.id}`).catch(() => null);
      if (now?.ok) setDraft((await now.json()) as DraftView);
      return say({ text: 'The draft changed', detail: 'It was edited before the approval reached the server. Read it again, then approve.', persistent: true });
    }
    say({ text: 'Not approved', detail: 'The approval could not be saved. Try again.', persistent: true });
  }

  function onEdit(i: number) {
    if (!shown.current.approvedOrTicking) return;
    withdraw();
    say(CLEARED, i);
  }

  /** A save always clears the stored approval (PUT does). If the box was ticked meanwhile, say so. */
  function onSaved(v: DraftView, i: number) {
    if (shown.current.approvedOrTicking) {
      generation.current += 1;
      setTicking(false);
      say(CLEARED, i);
    }
    setDraft(v);
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/export`, { method: 'POST' }).catch(() => null);
      if (!res?.ok) {
        if (res?.status === 403) setDraft((d) => ({ ...d, state: 'draft' }));
        return say({ text: 'Not exported', detail: res?.status === 403 ? 'The server has no approval for this exact text. Approve it again.' : 'The PDF could not be made. Try again.', persistent: true });
      }
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: filenameOf(res) });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setExporting(false);
    }
  }

  const check = { checked: draft.state === 'approved' || ticking, busy: ticking, ring: exorcisms, onChange: (on: boolean) => (on ? void approve() : withdraw()) };
  const pill = { approved, exporting, onExport: () => void exportPdf() };
  const toastNode = <Toast message={toast} onDismiss={dismiss} />;

  return (
    <>
      {/* The draft is still haunted; the approved reply lifts the mist. */}
      <Haunt level={0.6} exorcised={approved} />
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 tabIndex={-1} className="text-title outline-none">
              Exorcise the notice
            </h1>
            <span data-testid="draft-state">
              <StatusPill draft={draft.state} />
            </span>
          </div>
          <p className="mt-2 font-mono text-mono text-text-muted">{subtitle}</p>
          <SkippedNote skipped={skipped} />
        </div>
        <ExportPill {...pill} variant="header" className="hidden shrink-0 md:block" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          <DraftEditor draft={draft} onSaved={onSaved} onEdit={onEdit} after={toastAt === null ? undefined : { index: toastAt, node: toastNode }} />
        </div>
        <aside aria-label="About this draft" className="lg:sticky lg:top-6 lg:col-span-4">
          <ApprovalCard draft={draft} check={check} />
        </aside>
      </div>

      <div data-testid="thumb-bar" className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-canvas from-85% to-transparent px-4 pt-6 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <ApprovalCheck {...check} draft={draft} variant="bar" />
        <ExportPill {...pill} variant="bar" className="mt-2" />
      </div>

      {toastAt === null ? toastNode : null}
    </>
  );
}
