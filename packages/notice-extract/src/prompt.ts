/**
 * The extraction prompt. It asks the model to read and copy text, nothing else: no arithmetic.
 * Every amount the model writes is a printed figure; the duty engine does all the math later.
 */

const FIELD = '{"value": <as printed, or null>, "confidence": <0 to 1>, "page": <page number, from 1>}';

const SHAPE = `{
  "kind": "cbp_form_28" | "cbp_form_29" | "courier_duty_invoice",
  "noticeType": F,
  "actionType": F,
  "entryNumber": F,
  "dates": { "entry": F, "notice": F, "responseDeadline": F },
  "importer": { "name": F, "address": F },
  "port": F,
  "courier": null | { "name": F, "invoiceNumber": F, "waybill": F },
  "informationRequested": [F, ...],
  "lines": [{ "n": F, "description": F, "hts": F, "value": F, "quantity": F, "unit": F, "rateText": F, "dutyStated": F }, ...],
  "fees": [{ "name": F, "kind": F, "stated": F }, ...],
  "statedTotals": [{ "name": F, "stated": F }, ...]
}`;

const SYSTEM = `You read customs documents and copy what is printed on them into JSON. You only copy text. You do no arithmetic of any kind: never add, multiply, work out or fill in a figure that is not printed. Reply with one JSON object and nothing else.`;

const USER = `Read the attached page images of one document and return one JSON object with this shape, where every F is a field object:
F = ${FIELD}

${SHAPE}

Document kinds:
- "cbp_form_28": a CBP Form 28, Request for Information.
- "cbp_form_29": a CBP Form 29, Notice of Action.
- "courier_duty_invoice": a courier's duty and tax invoice.
If the document is none of these, return exactly {"kind": "unknown"}.

Fields:
- noticeType: the document title as printed, for example "Notice of Action".
- entryNumber: the customs entry number as printed.
- dates.entry: the entry date. dates.notice: the date of the notice, request or invoice. dates.responseDeadline: the respond-by or payment-due date, or null if none is printed.
- importer: the importer of record or consignee: name, and address on one line joined with ", ".
- port: the port of entry, for example "Long Beach, CA", without the words "Port of". null if no port is printed.
- actionType: on a Form 29 whose action is a rate advance, the value is "rate_advance". On every other document the value is null.
- courier: on a courier invoice, the courier company name, the invoice number and the waybill number as printed. On every other document courier is null (not an object).
- informationRequested: on a Form 28, one field per item of information requested, text as printed without the item number. On every other document it is [].
- lines: one object per line of goods, in printed order. n is the printed line number as a JSON number. description is the full description on one line. hts is the HTS number with its dots, as printed. value is the entered value. quantity is the number only, as a string, for example "320". unit is the unit printed after the quantity, for example "doz.", "kg" or "No.". rateText is the rate of duty text exactly as printed, for example "9.2%", "12.1¢/kg + 4.6%" or "Free". dutyStated is the duty printed on that line, or null if the document prints no duty for lines.
- fees: one object per fee printed on the document. kind is "mpf" for a Merchandise Processing Fee, "hmf" for a Harbor Maintenance Fee, or "courier_fee" for a charge of the courier itself. stated is the printed amount.
- statedTotals: one object per printed total row, with its label as name and its printed amount as stated. Fees are not repeated here.

Formats:
- Amounts (value, dutyStated, fees stated, statedTotals stated): digits with two decimals, no currency symbol, no thousands separator. "$4,815.00" is written "4815.00". "$0.00" is written "0.00".
- Dates: YYYY-MM-DD. "10/27/2026" is written "2026-10-27".
- Text fields: copied exactly as printed.
- confidence: how sure you are that you read the field correctly, from 0 to 1. If a field the document should have cannot be read, its value is null and its confidence is 0. Never guess a value.
- page: the number of the page image the value was read from, starting at 1.
- Every key in the shape is required. Do not add keys that are not in the shape.`;

export type Prompt = { system: string; user: string };

export function buildPrompt(): Prompt {
  return { system: SYSTEM, user: USER };
}

export type PromptIssue = { path: PropertyKey[]; message: string };

/** Appended to the user prompt on the one retry: the validation issues of the first reply. */
export function retryNote(issues: PromptIssue[]): string {
  const list = issues
    .slice(0, 30)
    .map((i) => `- ${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return `\n\nYour previous reply was not valid for the shape above. Problems found:\n${list}\nRead the document again and return the whole JSON object with these problems fixed.`;
}
