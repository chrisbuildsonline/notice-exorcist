import type { Specimen } from '../schema';
import { esc, fmtDate, linesTable, meta, page } from './base';

/** Request for information, in an original layout that only resembles the form type. */
export function form28Html(s: Specimen): string {
  const body = `
<div class="sub">Entry Review Office (fictional) · Port of ${esc(s.port ?? '')}</div>
<h1>${esc(s.noticeType)}</h1>
<p class="sub">We need more information to review the entry below.</p>
${meta([
  ['Entry number', s.entryNumber],
  ['Entry date', fmtDate(s.dates.entry)],
  ['Date of request', fmtDate(s.dates.notice)],
  ['Respond by', s.dates.responseDeadline ? fmtDate(s.dates.responseDeadline) : ''],
  ['Port of entry', s.port ?? ''],
])}
<div class="party">
  <div><span>Importer of record</span>${esc(s.importer.name)}<br>${esc(s.importer.address)}</div>
  <div><span>Reply to</span>Entry Review Office (fictional)<br>Import Specialist team</div>
</div>
<h2>Information requested</h2>
<ol class="requests">
${s.informationRequested.map((r) => `  <li>${esc(r)}</li>`).join('\n')}
</ol>
<h2>Entry lines under review</h2>
${linesTable(s.lines, false)}
<p class="text">Send the information by the response date. If you cannot reply in time, ask for more time before that date. This request does not change the duty on the entry.</p>
<p class="sign">Import Specialist, Entry Review Office (fictional)</p>`;
  return page(`${s.noticeType} ${s.entryNumber}`, body);
}
