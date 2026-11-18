# Requirements: exorcism-flow

App: `apps/web` (Next.js, Tailwind). Visual values come from `design/DESIGN.md`. Imports from `duty-engine`, `notice-extract` and `tariff-mcp`. Rules from `approval-gate.md`, `no-model-math.md` and `product.md` apply in full.

## Terms
- **Notice**: an uploaded or forwarded CBP Form 28, Form 29 or courier duty invoice.
- **Draft**: the cited reply text for a notice. States: `draft`, `approved`.
- **Content hash**: sha256 of the canonical serialization of the draft (paragraphs, in order, plus citations list).

## Requirements

### R1. Inbox (first screen)
1. WHEN the user opens the app, THE app SHALL show the Inbox as the first screen, with the title, the amount at stake and the one primary pill `Upload a notice`.
2. THE amount at stake SHALL be rendered by `<Figure>` with `computed` provenance from `duty-engine`.
3. THE list SHALL show one row per notice: kind icon, title, short line, `<Figure>` amount (or `—` when none), a notice-level status pill and the time.
4. WHEN no notices exist, THE app SHALL show the empty state with the headline "Exorcise your customs notice", one supporting line and the `Try a specimen` primary pill.
5. WHEN the user chooses `Try a specimen`, THE app SHALL load a bundled synthetic notice from fixtures, with no API key and no model.
6. THE Inbox SHALL show the dropzone and the forward address, with a Copy button.
7. ON phone widths, THE Inbox SHALL place `Upload a notice` in a sticky bottom bar.

### R2. Upload and extraction
1. WHEN the user drops or selects a PDF, PNG or JPEG up to the size limit (default 10 MB), THE app SHALL store it and start extraction via `notice-extract`.
2. IF the file type or size is invalid, THEN THE app SHALL reject it with a plain error message and no stored file.
3. WHILE extraction runs, THE row SHALL show a progress state.
4. IF extraction fails, THEN THE row SHALL show the failure reason in plain language and a retry action. No partial figures SHALL be shown.
5. WHEN Bedrock is enabled, THE app SHALL show a notice that the document is sent to a cloud service.

### R3. Inbound email: POST /api/inbound
1. THE endpoint SHALL accept a forwarded email as `multipart/form-data` with fields `to`, `from`, `subject`, `text` and file attachments.
2. THE endpoint SHALL require a shared secret in the `x-inbound-secret` header, compared in constant time with `INBOUND_SECRET` from env. IF it is missing or wrong, THEN THE endpoint SHALL return 401 and store nothing.
3. THE endpoint SHALL map the `to` address (`notices+<token>@<domain>`) to a user inbox. IF the token is unknown, THEN THE endpoint SHALL return 404.
4. THE endpoint SHALL process only PDF, PNG and JPEG attachments within the size limit. IF there is no valid attachment, THEN THE endpoint SHALL return 422.
5. WHEN valid, THE endpoint SHALL create one notice per attachment, start extraction, and return 202 with the notice ids.
6. THE endpoint SHALL NOT reply to the sender or send any email.
7. THE endpoint SHALL NOT log the email body, subject or attachment contents.

### R4. Haunted notice view
1. THE notice view SHALL show the title, the notice-level status pill and the three summary figures (notice says, recomputed, difference) with `stated` or `computed` tags.
2. THE notice SHALL be drawn as paper with one row per extracted line. Each row state (`unverified`, `disagrees`, `verified`, `confirm`, `unsupported`) SHALL come from `duty-engine` and extraction data, never from the model.
3. Rows in `disagrees` and `unverified` SHALL glow using the status hues. `confirm` and `unsupported` SHALL NOT glow. The violet accent SHALL NOT be used for glows or pills.
4. EVERY status SHALL show a word and an icon in addition to colour.
5. THE fog opacity SHALL follow `0.15 + 0.85 × (unverified + disagreeing) / total lines`, computed in a pure function with a unit test, and SHALL be 0 when all lines are verified.
6. WHEN all lines are verified, THE title pill SHALL read `✓ At peace`.
7. WHEN a stated and a computed figure differ, THE row SHALL show both side by side and SHALL NOT replace the stated one.
8. WHEN `prefers-reduced-motion: reduce` is set, THE app SHALL disable animation and keep a static glow.
9. WHEN a line has fields marked `needs_confirmation`, THE row SHALL show `Confirm`, and THE app SHALL require the user to confirm or correct the value before the line is calculated.
10. THE side panel SHALL show a plain-English explanation of the selected line, candidate HTS codes labelled "Candidates, not a final classification", and matching CROSS rulings, each with a citation.
11. THE explanation text SHALL be checked by code: any figure in the text SHALL match a figure that has provenance. Otherwise THE app SHALL show the text without that sentence and log a warning code.

### R5. Calculation drawer and Figure component
1. WHEN the user opens "See the math" for a line, THE app SHALL open a drawer showing the formula, inputs with sources, rate text, HTS edition, rounding rule, stated vs recomputed figures and the `Match` or `Mismatch` pill.
2. THE drawer SHALL be a focus-trapped dialog that closes on Esc and scrim click, and returns focus to the trigger.
3. THE `<Figure>` component SHALL require `prov` (`stated`, `computed` or `tariff`) and a `source`.
4. IF `prov` or `source` is missing, THEN `<Figure>` SHALL NOT render the number. It SHALL render `—` and an `⊘ Unsourced` pill. In development and test it SHALL throw.
5. `<Figure>` SHALL render money to 2 decimals with `$`, comma grouping, a true minus and tabular numbers.
6. THE provenance tag SHALL open a popover with the source.
7. THE drawer SHALL include the caption "Computed by duty-engine, not by the AI model."
8. THE API layer SHALL reject any response payload that contains a money figure without provenance, with a 500 in test and a safe error in production.

### R6. Cited reply draft
1. WHEN the user chooses `Exorcise this notice`, THE app SHALL generate a draft reply for the flagged lines, with state `draft`.
2. EACH claim in the draft SHALL have a citation chip linking to an HTS line, a CROSS ruling number or a notice box.
3. A figure in the draft SHALL be inserted as a `<Figure>`-backed token that references an existing provenance record. THE editor SHALL NOT accept a typed number as a figure token.
4. THE model MAY phrase text. THE model SHALL NOT supply figures. Figures are filled in by code from provenance records.
5. THE draft SHALL list sources at the end and a "Not legal advice. Draft only, never filed" line.
6. THE editor SHALL be plain text per paragraph.
7. THE app SHALL NOT file, send or email the draft.

### R7. Approval gate
1. THE approval card SHALL show a checkbox labelled "I approve this exact draft", unchecked by default, with the sha256 prefix, paragraph count and citation count.
2. WHEN the user ticks the box, THE app SHALL send an approval request containing the draft id and the full hash. THE server SHALL recompute the hash from the stored draft and record the approval only if it matches.
3. WHILE the box is unticked, THE `Export PDF` control SHALL be disabled, with `aria-disabled` and helper text "Approve the draft to export".
4. WHEN the draft is edited in any way, THE app SHALL clear the approval, untick the box, return the state to `draft`, and show a toast that stays until dismissed.
5. THE server SHALL clear the stored approval on any draft update.
6. WHEN `POST /api/drafts/:id/export` is called, THE server SHALL recompute the hash of the stored draft and compare it to the recorded approval. IF there is no approval or the hash differs, THEN THE server SHALL return 403 and no PDF.
7. THE app SHALL NOT approve by default, by saving, viewing, navigating or exporting.
8. Approval state SHALL be derived from the stored record on each load, never from client state alone.

### R8. PDF export
1. WHEN the approval is valid, THE server SHALL render a PDF of the approved draft. THE PDF SHALL be Letter by default, with A4 as an option.
2. THE PDF SHALL include the approved text with footnote citations, the calculation trail table (line, formula, inputs with source, rate text and HTS edition, notice vs recomputed, rounding rule) and the sources list.
3. EVERY page SHALL carry the footer "Not legal advice. Draft only, never filed by Notice Exorcist.", the approved hash and "page x of y".
4. THE PDF SHALL be black and grey only, with status shown as words in brackets.
5. THE renderer SHALL be a server-side renderer already in the repo (Playwright Chromium `page.pdf`). IF a new dependency is needed, THEN THE change SHALL state why.
6. THE PDF content hash in its metadata SHALL equal the approved hash.

### R9. Accessibility and layout
1. Interactive targets SHALL be at least 44×44px. Body text on phone SHALL be at least 16px.
2. Text SHALL meet WCAG AA. Focus SHALL be visible.
3. Each screen SHALL have at most one near-black primary pill.
4. Phone layouts SHALL follow `design/DESIGN.md` section 5, not a shrunk desktop layout.

5. See `.kiro/specs/accessibility-edge-cases` for the accessibility and edge-case parts of R9.
### R10. Privacy and config
1. Config and secrets SHALL come from env vars. THE app SHALL NOT log notice contents.
2. The app SHALL run in local-only mode with Ollama or fixtures and no cloud calls.
3. The default store SHALL be local SQLite.
