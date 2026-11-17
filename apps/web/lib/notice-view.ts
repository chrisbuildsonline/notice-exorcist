import type { ExtractResult, FailureReason } from '@notice-exorcist/notice-extract';
import { type Assessment, assess } from './assess';
import { applyConfirmations, type Confirmation } from './confirm';
import type { NoticeRow } from './intake';

const FAILURES: Record<FailureReason, string> = {
  no_fixture: 'No recorded reading for this file. Set EXTRACT_MODE=live and start Ollama to read new notices.',
  model_unreachable: 'The local model is not running. Start Ollama and try again.',
  timeout: 'Reading took too long. Try again, or upload a clearer copy.',
  not_json: 'The reader could not make sense of this file. Try a clearer copy.',
  schema_invalid: 'The reader could not make sense of this file. Try a clearer copy.',
  unrecognized_document: 'This does not look like a CBP Form 28, 29 or courier duty invoice.',
  unsupported_input: 'That file is not a PDF, PNG or JPEG.',
  too_many_pages: 'That PDF has too many pages.',
};

const TITLES: Record<string, string> = {
  cbp_form_28: 'CBP Form 28 · Request for information',
  cbp_form_29: 'CBP Form 29 · Notice of Action',
  courier_duty_invoice: 'Courier duty invoice',
};

export type NoticeView = {
  id: string;
  status: NoticeRow['status'];
  kind: string | null;
  source: NoticeRow['source'];
  createdAt: string;
  title: string;
  summary: string;
  failure?: { reason: FailureReason; message: string };
  /** As printed on the notice (stated fields, not money). */
  header?: { entryNumber: string | null; noticeDate: string | null; respondBy: string | null };
  assessment?: Assessment;
};

// "ending 5187", not "…5187": CSS truncation adds its own ellipsis.
const last4 = (s: string | null) => (s ? `ending ${s.replace(/\D/g, '').slice(-4)}` : 'unknown');

function summary(r: Extract<ExtractResult, { ok: true }>): string {
  const n = r.notice;
  const lines = `${n.lines.length} ${n.lines.length === 1 ? 'line' : 'lines'}`;
  if (n.kind === 'cbp_form_28') return `Asks for ${n.informationRequested.length} items · Entry ${last4(n.entryNumber.value)}`;
  if (n.kind === 'cbp_form_29') return `Rate advance on ${lines} · Entry ${last4(n.entryNumber.value)}`;
  return `${n.courier.name.value ?? 'Courier'} · duty and fees, ${lines}`;
}

/**
 * What the API and the inbox show for a stored notice. A failed reading carries a reason and no figures.
 * Values the user confirmed are applied before the engine checks anything.
 */
export function noticeView(row: NoticeRow, confirmations: Confirmation[] = []): NoticeView {
  const base = { id: row.id, status: row.status, kind: row.kind, source: row.source, createdAt: row.created_at };
  if (row.status === 'reading' || !row.extracted_json) return { ...base, title: row.filename, summary: 'Reading the notice…' };
  const read = JSON.parse(row.extracted_json) as ExtractResult;
  if (!read.ok) return { ...base, title: row.filename, summary: FAILURES[read.reason], failure: { reason: read.reason, message: FAILURES[read.reason] } };
  const r = { ...read, notice: applyConfirmations(read.notice, confirmations) };
  const n = r.notice;
  const header = { entryNumber: n.entryNumber.value, noticeDate: n.dates.notice.value, respondBy: n.dates.responseDeadline.value };
  return { ...base, title: TITLES[n.kind] ?? n.kind, summary: summary(r), header, assessment: assess(r) };
}
