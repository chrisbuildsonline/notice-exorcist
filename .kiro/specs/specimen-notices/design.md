# Design: specimen-notices

## Layout
```
scripts/specimens/
  generate.ts         entry point: load data, validate, render, write
  data.ts             the three specimens as typed literals (the stated figures live here)
  schema.ts           Zod schema for FieldsJson (specimen ground truth)
  html/
    base.ts           shared page chrome: CSS, SPECIMEN stamp, footer
    form28.ts  form29.ts  courier.ts     HTML string builders, no I/O
  render.ts           Playwright: html -> pdf, png
  photo.ts            specimen 2 png -> skewed phone photo jpg
  serialize.ts        stable JSON (sorted keys, 2 spaces, trailing newline)
  license.ts          LICENSE.txt text
  *.test.ts           Vitest, beside the code (snapshot, engine, tariff)
fixtures/specimens/
  specimen-1-form28.{pdf,png,fields.json}
  specimen-2-form29.{pdf,png,fields.json}
  specimen-2-form29.photo.jpg
  specimen-3-courier.{pdf,png,fields.json}
  LICENSE.txt
```
Root `package.json` gets one script: `"specimens:generate": "bun scripts/specimens/generate.ts"`.

The generator is a dev tool. It lives in `scripts/`, imports packages (`duty-engine`, `tariff-data`) and never `apps/web`. Packages do not import it. The engine and tariff data are used only by tests and by a startup check, never to produce a stated figure (see Decisions).

## Data flow
1. `data.ts` exports three `Specimen` literals. Every stated figure is a literal string written by a person. The planted lines carry `plantedError: true` and `expectedDuty` or `expectedFee`, also literals.
2. `generate.ts` parses each literal with `schema.ts` (Zod). A schema failure aborts the run.
3. Preflight: the built tariff index exists and Chromium launches. Otherwise exit 1 with the missing step (`bun run --cwd packages/tariff-data data:build`, `bunx playwright install chromium`).
4. `html/*.ts` turn a `Specimen` into a self-contained HTML string (inline CSS, system font stack, no remote resources). The same input gives the same string.
5. `render.ts` opens one Chromium page per specimen. `page.setContent`, `page.emulateMedia({ media: 'print' })`, `page.pdf({ format: 'Letter', printBackground: true, margin: 0.75in })`, then `page.screenshot` of page 1 at `deviceScaleFactor: 2` and a fixed viewport (816 x 1056).
6. `photo.ts` loads the specimen 2 PNG into a second HTML page as an `<img>` with a CSS 3D transform and overlays, then `page.screenshot({ type: 'jpeg', quality: 82 })` at a 1200 x 1600 viewport (3:4).
7. `serialize.ts` writes each fields JSON. `license.ts` writes `LICENSE.txt`.

## SPECIMEN marking
- `base.ts` emits a `.stamp` element with `position: fixed` and a repeating diagonal `SPECIMEN` text in a light grey with `pointer-events: none`. Chromium repeats fixed elements on every printed page. It sits at `z-index` below text and is at `opacity: .16`, so figures stay readable and the stamp still shows. It is real text, so it appears in the PDF text layer (R3.5).
- A footer, also `position: fixed; bottom`, carries the fixed line from R3.2 on every page.
- A small bordered box at the top right reads `SPECIMEN` in text, outside the figure area. The stamp is therefore present twice per page, so a crop of the page still shows it.
- Colours follow `design/DESIGN.md` greys only in the page chrome: ink `#14161c`, text-muted `#646a79`, line `#e6e8ee`. Specimens are paper documents, not app UI, so no status hues, glow or accent are used. The spooky words are not used.

## Specimen content
All names are invented. Entry numbers use a reserved fake filer prefix so they cannot match a real entry. Dates fall inside one fee-table period of `packages/duty-engine/data/fees.json`.

| | Specimen 1 | Specimen 2 | Specimen 3 |
|---|---|---|---|
| Kind | `cbp_form_28` | `cbp_form_29` | `courier_duty_invoice` |
| Lines | 2 to 3, no duty stated | 4 lines, one planted | 3 lines, all correct |
| Planted error | none | one line's duty | MPF |
| Rate shapes | any | at least one `Free`, one compound or specific, others ad valorem | ad valorem |
| Fees | none | stated MPF, correct | stated MPF (wrong), courier fee, total payable |

HTS codes are chosen when `data.ts` is written, by querying the built index (`searchHts`, then `lookupHts`) and keeping codes with a supported rate text and no AD/CVD or Chapter 99 note. The chosen codes and their exact `general` rate text are then copied into `data.ts` as literals. The tariff test (below) fails if the index later disagrees.

### Planted errors
- **Specimen 2.** The wrong duty is a plausible clerical error: the right rate applied to a value that was transposed, or the rate of the neighbouring subheading. The engine-correct figure is in `expectedDuty`. The difference must be at least $1.00 so no rounding rule explains it.
- **Specimen 3.** The wrong MPF is a plausible error: the unclamped percentage where the engine clamps to the minimum or maximum, or the prior-period rate. The invoice is built so that the engine MPF and the stated MPF differ by at least $1.00. Preference goes to the clamp case, because it exercises `computeMpf` min/max.

## Photo transform (`photo.ts`)
Seed constant `PHOTO_SEED = 0x5eed1e57` and a small inline mulberry32 PRNG (about 6 lines; no dependency). The seed picks, within fixed ranges:
- rotation 4 to 12 degrees
- `perspective` and `rotateX/rotateY` of a few degrees
- shadow: a rotated linear-gradient overlay (`rgba(20,22,28,.35)` to transparent) over a third of the page, plus a drop shadow around the paper
- background: a flat wood-grey colour from a short list
- blur 0.4 to 0.8px via CSS `filter`, noise from an inline SVG `feTurbulence` overlay at low opacity
- paper placed off-centre so the background shows on all sides

The viewport is 1200 x 1600. The `SPECIMEN` stamp is part of the source PNG, so it stays in the photo.

## Fields JSON shape
```ts
const Money = z.string().regex(/^-?\d+\.\d{2}$/);
const Dec = z.string().regex(/^-?\d+(\.\d+)?$/);
const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Line = z.object({
  n: z.number().int().positive(),
  description: z.string(),
  hts: z.string().regex(/^\d{4}\.\d{2}\.\d{2}(\.\d{2})?$/),
  value: Money,
  quantity: Dec.nullable(),
  unit: z.string().nullable(),
  rateText: z.string(),
  dutyStated: Money.nullable(),
  plantedError: z.literal(true).optional(),
  expectedDuty: Money.optional(),       // test oracle, not printed
}).strict();

const Fee = z.object({
  name: z.string(),
  kind: z.enum(['mpf', 'hmf', 'courier_fee']),
  stated: Money,
  plantedError: z.literal(true).optional(),
  expectedFee: Money.optional(),        // test oracle, not printed
}).strict();

const Fields = z.object({
  specimenId: z.string(),
  kind: z.enum(['cbp_form_28', 'cbp_form_29', 'courier_duty_invoice']),
  noticeType: z.string(),
  entryNumber: z.string(),
  dates: z.object({ entry: Iso, notice: Iso, responseDeadline: Iso.nullable() }).strict(),
  importer: z.object({ name: z.string(), address: z.string() }).strict(),
  port: z.string().nullable(),
  courier: z.object({ name: z.string(), invoiceNumber: z.string(), waybill: z.string() }).strict().nullable(),
  informationRequested: z.array(z.string()),   // Form 28; empty for others
  lines: z.array(Line).min(1),
  fees: z.array(Fee),
  statedTotals: z.array(z.object({ name: z.string(), stated: Money }).strict()),
  notes: z.array(z.string()),
}).strict();
```
Exactly one of `plantedError` across lines and fees exists in specimens 2 and 3, and none in specimen 1. The schema allows the optional keys, and a test enforces the counts.

The JSON is a plain, hand-labelled ground truth. It is not the `notice-extract` Zod shape (which wraps each value with confidence and provenance). The eval task of `notice-extraction` (task 16) maps it to expected labels by field name, and the mapping belongs to that package. Open question below.

## Decisions
- **Stated figures are literals, not engine output.** If the generator asked the engine for the correct figures, the "agrees with the engine" test would be circular. Written literals mean the test checks the data, and a change in the engine or the rate text shows up as a failing test.
- **Planted errors are explicit in the data** (`plantedError`, `expectedDuty`, `expectedFee`). The test knows which figure should disagree without inferring it.
- **Engine and tariff index are test oracles, not generator inputs.** The generator touches the index only for a preflight existence check, which makes a stale checkout fail early.
- **No new dependency.** Playwright is in the repo for e2e. A tiny PRNG is inline. HTML is built with template strings.
- **Fixed seed, fixed viewport, fixed fonts** (system stack only, no web fonts) keep HTML and JSON stable. PDF and image bytes may still vary (Chromium embeds a creation date and its version), so they are not snapshot-tested byte for byte.
- **Fields JSON is the contract.** Byte-level tests apply only to JSON. Binary outputs get structural checks.
- **No spooky styling.** Specimens must resemble real paper notices so extraction is tested honestly.
- **Courier fee is typed `courier_fee`.** The engine has no formula for it, and the test leaves it out. This matches `unsupported` in `design/DESIGN.md` 2.1.
- **Total payable is read, not recomputed.** A `statedTotals` entry is a stated figure. Reconciliation is the engine's job, not the generator's.
- **Committed outputs.** The specimens are small, they are fixtures for other specs, and CI should not need Chromium to run `bun run test`.

## Testing
Vitest tests sit beside the code in `scripts/specimens/`. The root Vitest config must include `scripts/**`. The tariff test needs the built index and the `bun:sqlite` driver, which Vitest under Node does not provide, so it follows the `tariff-data` convention: `*.bun.test.ts`, run with `bun test`, and the root `test` script runs it after Vitest. Tests that import `duty-engine` run in Vitest.

| Test file | Runner | Proves |
|---|---|---|
| `schema.test.ts` | Vitest | each `data.ts` literal parses; planted counts are 0, 1, 1; no `number` money |
| `fields.snapshot.test.ts` | Vitest | `serialize(specimen)` equals the committed `*.fields.json` and a `toMatchSnapshot` copy |
| `engine.test.ts` | Vitest | planted figures disagree; all others agree, to the cent |
| `tariff.bun.test.ts` | bun test | each HTS exists, rate text equals the index text |
| `outputs.test.ts` | Vitest + Playwright | generator output: files, stamp, page counts, photo size |
| `license.test.ts` | Vitest | `LICENSE.txt` content |

## Risks and open questions
- **Page count check.** The test counts `/Type /Page` objects in PDF bytes. Skia PDFs keep page objects uncompressed today. IF a Chromium update changes that, switch to counting `.stamp` boxes in `page.pdf` output via a second render, not to a new dependency.
- **Fields JSON vs. extraction fixtures.** `notice-extraction` task 12 needs recorded model responses in its own shape. A recorded response is a model output, so it must be produced in `EXTRACT_MODE=record` from the specimen files and reviewed by hand against these fields JSON. Confirm that is the intended flow, not a hand-built conversion.
- **Fee period.** The dates must fall in a fee-table period. If the table has no period for a date the test reports `no_fee_table_for_date`, and the dates in `data.ts` need to move. The current fee table is read when the data is written.
- **Compound-rate line.** If no real code with a supported compound or specific rate suits a small importer, specimen 2 uses a specific rate (for example cents per kilogram) and the compound requirement is dropped by amending R6.4.
- **kiro-config.** Removing the `fixtures/**` exemption makes the `refresh-fixture-index` pattern require a match. `fixtures/specimens/` must be committed in the same change.
