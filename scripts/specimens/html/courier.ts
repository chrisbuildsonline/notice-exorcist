import type { Specimen } from '../schema';
import { esc, fmtDate, linesTable, meta, page, sumsTable } from './base';

/** Courier duty invoice for a fictional courier, in an original layout (text only, no logo). */
export function courierHtml(s: Specimen): string {
  const c = s.courier ?? { name: '', invoiceNumber: '', waybill: '' };
  const fees = s.fees.filter((f) => f.kind !== 'courier_fee');
  const courierFees = s.fees.filter((f) => f.kind === 'courier_fee');
  const body = `
<div class="sub"><strong>${esc(c.name)}</strong> · Customs brokerage (fictional courier)</div>
<h1>${esc(s.noticeType)}</h1>
<p class="sub">Duties and fees we paid to customs for your shipment.</p>
${meta([
  ['Invoice number', c.invoiceNumber],
  ['Invoice date', fmtDate(s.dates.notice)],
  ['Payment due', s.dates.responseDeadline ? fmtDate(s.dates.responseDeadline) : ''],
  ['Waybill', c.waybill],
  ['Customs entry number', s.entryNumber],
  ['Entry date', fmtDate(s.dates.entry)],
])}
<div class="party">
  <div><span>Bill to (consignee)</span>${esc(s.importer.name)}<br>${esc(s.importer.address)}</div>
  <div><span>From</span>${esc(c.name)}<br>Customs brokerage desk</div>
</div>
<h2>Duty by line</h2>
${linesTable(s.lines, true)}
${sumsTable([...s.statedTotals, ...fees, ...courierFees], 'Total payable')}
<p class="text">Government duties and fees were paid on your behalf. The disbursement fee is our own charge. Pay by the due date shown above.</p>`;
  return page(`${s.noticeType} ${c.invoiceNumber}`, body);
}
