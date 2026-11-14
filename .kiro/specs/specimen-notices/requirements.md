# Requirements: specimen-notices

A deterministic generator script that produces three fictional customs notices and one phone-photo variant. They feed the extraction fixtures (`notice-extraction` R6.5), the eval labels (R9), the "Try a specimen" action on the empty Inbox (`design/DESIGN.md` 5.1), and the demo. Each specimen carries a ground-truth fields JSON. Every figure in the JSON is `stated` (`no-model-math.md`). Two stated figures are wrong on purpose so the product has something to flag.

## Terms
- **Specimen**: a synthetic document produced by the generator, in `fixtures/specimens/`.
- **Specimen 1**: CBP Form 28-style Request for Information. **Specimen 2**: CBP Form 29-style Notice of Action (rate advance). **Specimen 3**: courier duty invoice. **Specimen 2 photo**: the phone-photo JPG of specimen 2.
- **Planted error**: a stated figure that disagrees with the duty engine by design.
- **Fields JSON**: the ground-truth file for one specimen (`<id>.fields.json`).
- **Duty engine**: `packages/duty-engine`. **Tariff index**: the built SQLite FTS5 index from `packages/tariff-data`.

## Requirements

### R1. Generator
1. THE generator SHALL be a TypeScript script run with `bun run specimens:generate` from the repo root.
2. THE generator SHALL render HTML to PDF with Playwright Chromium `page.pdf`, and HTML to PNG with `page.screenshot`.
3. THE generator SHALL write to `fixtures/specimens/` only, and SHALL make no network call.
4. THE generator SHALL be deterministic in content: running it twice SHALL produce byte-identical fields JSON and the same HTML. It SHALL take no input from the clock, locale or random source other than a fixed seed.
5. THE generator SHALL document that PDF, PNG and JPG bytes are not guaranteed identical across runs or Chromium versions, and the fields JSON is the stable contract.
6. THE generator SHALL fail with a non-zero exit code and a message naming the missing prerequisite IF Chromium is not installed or the tariff index is not built.
7. THE generator SHALL import no code from `apps/web`.

### R2. Outputs
1. THE generator SHALL write, per specimen `<id>` (`specimen-1-form28`, `specimen-2-form29`, `specimen-3-courier`): `<id>.pdf`, `<id>.png` (page 1 at fixed device scale) and `<id>.fields.json`.
2. THE generator SHALL also write `specimen-2-form29.photo.jpg`.
3. THE generator SHALL write `LICENSE.txt` stating that the specimens are synthetic, original, contain no real person, company or entry, and are released under the MIT license.
4. THE generator SHALL write no other file.

### R3. Specimen marking and fictional data
1. EVERY page of every PDF, and every PNG and JPG, SHALL carry a visible `SPECIMEN` stamp. The stamp SHALL not cover any figure, code or date.
2. EVERY page SHALL carry a footer line: "SPECIMEN. Fictional document for software testing. Not issued by CBP or any courier."
3. ALL company, person, street and broker names SHALL be fictional and invented. NO logo, seal or form layout SHALL copy an official CBP or courier document. Layouts are original and merely resemble the form type.
4. ALL entry numbers SHALL be fictional and SHALL use a filer code prefix that is not a real filer code (the generator keeps a list of reserved fake prefixes, `ZZ9` style) so they cannot identify a real entry.
5. THE specimens SHALL be stamped `SPECIMEN` in the PDF text layer, so text extraction also shows it.

### R4. Real HTS codes and rates
1. EVERY HTS code on a line SHALL exist in the tariff index (`lookupHts` returns `ok`).
2. EVERY rate text printed on a line SHALL equal the `general` rate text of that code in the index, character for character.
3. THE generator SHALL use only codes whose rate text `parseRateText` supports (`free`, `ad_valorem`, specific, or compound), except where a specimen deliberately includes one unsupported line to exercise the `unsupported` path. IF it does, the line SHALL be named in the fields JSON `notes`.
4. THE codes SHALL describe goods a small US importer plausibly buys (for example ceramic tableware, kitchen textiles, small hardware). NO code SHALL be one with an AD/CVD or Chapter 99 note on the specimen.

### R5. Specimen 1: Form 28 (Request for Information)
1. SPECIMEN 1 SHALL show: notice type, entry number, entry date, notice date, response deadline, port, importer name and address, a list of at least 4 information requested, and at least 2 entry lines (description, HTS, entered value, quantity and unit, rate text).
2. SPECIMEN 1 SHALL state no duty figure on its lines. The fields JSON SHALL hold those fields as `null`.
3. SPECIMEN 1 SHALL contain no planted error.

### R6. Specimen 2: Form 29 (Notice of Action, rate advance)
1. SPECIMEN 2 SHALL show: notice type, action type `rate_advance`, entry number, entry date, notice date, response deadline, port, importer, and at least 4 lines, each with description, HTS, entered value, quantity and unit, rate text and duty stated, plus a stated MPF.
2. EXACTLY ONE line's stated duty SHALL disagree with `computeLineDuty` for that line's rate text, entered value and quantity. Every other stated duty and the stated MPF SHALL equal the engine result to the cent.
3. THE fields JSON SHALL mark the planted line with `plantedError: true` and the engine-correct duty in `expectedDuty`.
4. AT least one line SHALL use a compound or specific rate, and at least one SHALL be `Free`.

### R7. Specimen 3: courier duty invoice
1. SPECIMEN 3 SHALL show: courier (fictional) name, invoice number, waybill number, dates, consignee, and at least 3 lines with description, HTS, value, quantity and unit, rate text and duty stated, plus fee lines: stated MPF, stated courier disbursement fee, and a stated total payable.
2. THE stated MPF SHALL disagree with `computeMpf` for the invoice's total entered value and entry date. Every stated line duty SHALL equal `computeLineDuty`.
3. THE courier disbursement fee is not a government fee. THE fields JSON SHALL mark it `kind: "courier_fee"` and SHALL NOT claim it is checkable by the engine.
4. THE stated total payable SHALL be printed as the document gives it. THE test SHALL NOT require it to equal any sum. IF it is the arithmetic sum of the stated figures, that SHALL be noted in `notes`.
5. THE fields JSON SHALL mark the planted MPF with `plantedError: true` and the engine-correct MPF in `expectedFee`.

### R8. Phone photo of specimen 2
1. THE photo SHALL be a JPG of specimen 2 page 1, with a perspective transform, a rotation of 4 to 12 degrees, a soft cast shadow across part of the page, and mild blur and noise.
2. THE photo SHALL have an aspect ratio that is neither Letter nor A4 nor square (for example 3:4 portrait phone crop, with background visible around the paper).
3. THE photo transform parameters SHALL come from a fixed seed in the generator source.
4. EVERY figure SHALL remain legible to a person at 100% zoom, and the `SPECIMEN` stamp SHALL stay visible.
5. THE photo SHALL share the fields JSON of specimen 2. THE generator SHALL NOT write a separate fields file for it.

### R9. Fields JSON
1. EACH fields JSON SHALL include: `specimenId`, `kind` (`cbp_form_28 | cbp_form_29 | courier_duty_invoice`), `noticeType` as printed, `entryNumber`, `dates` (ISO `YYYY-MM-DD`: entry, notice, response deadline or `null`), `importer` (name, address), `port` or `courier`, `lines[]`, `fees[]`, `statedTotals[]`, `notes`.
2. EACH line SHALL include: `n`, `description`, `hts`, `value`, `quantity`, `unit`, `rateText`, `dutyStated`, and, only for planted lines, `plantedError` and `expectedDuty`.
3. MONEY SHALL be a decimal string with two decimals, never a JS number. QUANTITY SHALL be a decimal string.
4. VALUES not printed on a document SHALL be `null`, never a made-up value.
5. THE fields JSON SHALL contain only values printed on the document (`notice-extraction` R3.4). Engine results appear only in `expectedDuty` and `expectedFee`, and these are labelled test oracles that the document does not print.
6. KEYS SHALL be sorted and output indented by two spaces with a trailing newline, so diffs are stable.

### R10. Tests
1. A SNAPSHOT test SHALL cover each generated fields JSON.
2. A TEST SHALL show the planted figures disagree with the engine, and every other stated figure agrees.
3. A TEST SHALL show every HTS code exists in the tariff index and the printed rate text equals the index rate text.
4. TESTS SHALL need no network and no model.

### R11. Repository hygiene
1. THE `refresh-fixture-index` hook watches `fixtures/**`. ONCE `fixtures/specimens/` exists, `test/kiro-config.test.ts` SHALL stop exempting `fixtures/**`: the `MAY_MATCH_NOTHING_YET` set SHALL be removed (or emptied) and its comment deleted, so the hook pattern must match a real path.
2. THE specimens SHALL be committed. THE generator SHALL not run as part of `bun run test`.
3. THE README and `packages/tariff-data/data/SOURCES.md` license notes SHALL stay accurate: specimens are MIT, tariff data is public domain.
4. THE generator SHALL add no new dependency. Playwright and the workspace packages already exist.
