import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DraftWorkspace } from '../../../../components/DraftWorkspace';
import { GhostGlyph } from '../../../../components/GhostGlyph';
import { confirmationsFor } from '../../../../lib/confirm';
import { draftView, ensureDraft } from '../../../../lib/drafts';
import { getNotice } from '../../../../lib/intake';
import { noticeView } from '../../../../lib/notice-view';

export const dynamic = 'force-dynamic';

/** Draft, approve, export. Opening it builds the draft once; it never approves anything. */
export default async function ExorcisePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const row = getNotice(id);
  if (!row) notFound();
  const draft = await ensureDraft(id);
  if (!draft) redirect(`/notices/${id}`);
  const v = noticeView(row, confirmationsFor(id));
  const subtitle = [`Reply to ${v.title}`, v.header?.entryNumber && `Entry ${v.header.entryNumber}`].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 md:px-8">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-body font-semibold tracking-tight">
          <GhostGlyph size={24} />
          Notice Exorcist
        </Link>
      </header>
      <main>
        <Link href={`/notices/${id}`} className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-body font-medium text-accent hover:text-accent-700">
          <span aria-hidden="true">←</span> Notice
        </Link>
        <DraftWorkspace initial={await draftView(draft)} subtitle={subtitle} />
      </main>
    </div>
  );
}
