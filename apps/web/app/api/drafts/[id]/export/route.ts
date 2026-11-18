import { isApproved } from '../../../../../lib/approval';
import { confirmationsFor } from '../../../../../lib/confirm';
import { contentOf, getDraftRow } from '../../../../../lib/drafts';
import { draftHash } from '../../../../../lib/hash';
import { getNotice } from '../../../../../lib/intake';
import { noticeView } from '../../../../../lib/notice-view';
import { renderPdf, trailOf } from '../../../../../lib/pdf';
import { sourced } from '../../../../../lib/provenance-guard';

export const dynamic = 'force-dynamic';

/**
 * POST { paper?: 'A4' }: the PDF of the stored draft, only when an approval row exists for the hash recomputed
 * from the stored draft now. Otherwise 403 and no PDF. Approval is never read from the request.
 */
export const POST = sourced(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const row = getDraftRow((await ctx.params).id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  if (!(await isApproved(row))) return Response.json({ error: 'approval_required' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { paper?: unknown } | null;
  const content = contentOf(row);
  const hash = await draftHash(content);
  const notice = getNotice(row.notice_id);
  const v = notice ? noticeView(notice, confirmationsFor(row.notice_id)) : null;
  const entry = v?.header?.entryNumber;
  const pdf = await renderPdf({
    title: `Response to ${v?.title ?? 'the notice'}`,
    subtitle: entry ? `Entry ${entry}` : 'Reply draft',
    content,
    hash,
    trail: v?.assessment ? trailOf(v.assessment) : [],
    paper: body?.paper === 'A4' ? 'A4' : 'Letter',
  });
  return new Response(pdf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="notice-reply-${hash.slice(0, 8)}.pdf"`,
      'cache-control': 'no-store',
    },
  });
});
