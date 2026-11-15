import type { Specimen } from '../schema';
import { esc, fmtDate, linesTable, meta, page, sumsTable } from './base';

const ACTION_LABEL = { rate_advance: 'Rate advance' } as const;

/** Notice of action, in an original layout that only resembles the form type. */
export function form29Html(s: Specimen): string {
  const action = s.actionType ? ACTION_LABEL[s.actionType] : '';
  const body = `
<div class="sub">Entry Review Office (fictional) · Port of ${esc(s.port ?? '')}</div>
<h1>${esc(s.noticeType)}</h1>
<p class="sub">Action on the entry below: <strong>${action}</strong></p>
${meta([
  ['Entry number', s.entryNumber],
  ['Entry date', fmtDate(s.dates.entry)],
  ['Date of notice', fmtDate(s.dates.notice)],
  ['Respond by', s.dates.responseDeadline ? fmtDate(s.dates.responseDeadline) : ''],
  ['Port of entry', s.port ?? ''],
  ['Action', action],
])}
<div class="party">
  <div><span>Importer of record</span>${esc(s.importer.name)}<br>${esc(s.importer.address)}</div>
  <div><span>Reply to</span>Entry Review Office (fictional)<br>Import Specialist team</div>
</div>
<h2>Proposed classification and duty</h2>
<p class="text">We propose to advance the rate of duty on this entry. The lines below show the classification, rate and duty as proposed.</p>
${linesTable(s.lines, true)}
${sumsTable([...s.statedTotals, ...s.fees])}
<p class="text">If you disagree, reply in writing by the response date with your reasons and any supporting documents. If we do not hear from you, the entry may be liquidated as proposed.</p>
<p class="sign">Import Specialist, Entry Review Office (fictional)</p>`;
  return page(`${s.noticeType} ${s.entryNumber}`, body);
}
