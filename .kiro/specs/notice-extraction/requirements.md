# Requirements: notice-extraction

Package: `packages/notice-extract`. Reads a scan, photo, PNG, JPG or PDF of a CBP Form 28, CBP Form 29 or courier duty invoice and returns schema-validated JSON. Every value read here is `stated` (`no-model-math.md`). The model reads. It never computes.

## Terms
- **Stated field**: a value read from the notice, with page, bounding box if available, and confidence.
- **Specimen schema**: the Zod schema in `scripts/specimens/schema.ts` that types `fixtures/specimens/*.fields.json`, the ground truth for the three specimens.
- **Oracle keys**: `specimenId`, `notes`, `plantedError`, `expectedDuty`, `expectedFee`. They exist in the specimen schema for tests and are not printed on a document, so the extraction schema does not have them.
- **Fixture**: a recorded model response stored in the repo, keyed by the sha256 of the input bytes.
- **Acceptance inputs**: `specimen-1-form28.pdf`, `specimen-2-form29.pdf`, `specimen-3-courier.pdf`, `specimen-2-form29.png` and the skewed phone photo `specimen-2-form29.photo.jpg`, all under `fixtures/specimens/`.

## Requirements

### R1. Notice schema aligned with the specimen schema
1. THE package SHALL define Zod schemas for three document kinds, `cbp_form_28`, `cbp_form_29` and `courier_duty_invoice`, in a discriminated union on `kind`. The kind values SHALL equal the specimen schema `kind` enum.
2. THE extraction schema SHALL have the same field names, nesting and value formats as the specimen schema, except for the oracle keys, and with each leaf wrapped as a stated field (R2). This covers `noticeType`, `actionType`, `entryNumber`, `dates` (`entry`, `notice`, `responseDeadline`), `importer`, `port`, `courier`, `informationRequested`, `lines` (`n`, `description`, `hts`, `value`, `quantity`, `unit`, `rateText`, `dutyStated`), `fees` (`name`, `kind`, `stated`) and `statedTotals`.
3. Form 29 SHALL include `actionType`, using the same enum as the specimen schema (today `rate_advance`). It SHALL be `null` for the other two kinds. Form 28 SHALL include `informationRequested`. The courier invoice SHALL include `courier`, and its fee and total lines as stated.
4. Money SHALL be a decimal string with the specimen format (`-?\d+\.\d{2}`), never a JS number. Quantity SHALL be a decimal string. THE package SHALL NOT strip, pad or otherwise rewrite money strings. The prompt asks for digits only, with no currency symbol or thousands separator.
5. A parity test SHALL fail when the key set of the extraction schema differs from the specimen schema minus the oracle keys, or when an enum or regex differs. A change to the specimen schema therefore forces a change here.
6. EVERY field SHALL be optional only where the form genuinely allows it. A missing required field SHALL be expressed as `null` with confidence `0`, never as a made-up value.

### R2. Stated provenance and confidence
1. EVERY extracted field SHALL be wrapped as `{ value, confidence, page, box?, prov: { kind: 'stated', source } }`.
2. `confidence` SHALL be a number from 0 to 1 reported by the extractor.
3. WHEN confidence is below the configured threshold (default `0.8`), THE package SHALL mark the field `needs_confirmation`.
4. WHEN a field is `needs_confirmation`, THE UI-facing result SHALL expose it so the user must confirm or correct it before it is used in a calculation.
5. THE package SHALL NOT relabel a stated value as `computed`.

### R3. No model math
1. THE extraction prompt SHALL ask only for text, and SHALL NOT ask for totals, sums, conversions or percentages.
2. WHEN the model returns a total that is printed on the notice, THE package SHALL store it as a stated total.
3. THE package SHALL NOT add, round or convert figures. Reconciliation is done by `duty-engine`. The compare function (R10) compares strings for equality only.
4. WHEN the schema has a derived-looking field that is not printed on the document, THE schema SHALL NOT include it.

### R4. Validation at the boundary
1. THE package SHALL parse every model response with the Zod schema.
2. IF parsing fails, THEN THE package SHALL return `{ ok: false, issues }` with Zod issues and the raw response kept in memory only for the caller to retry. It SHALL NOT repair, coerce or default values silently.
3. WHEN the model returns non-JSON, THE package SHALL return `{ ok: false, reason: 'not_json' }`.
4. THE package SHALL allow one automatic retry with the validation issues appended to the prompt. A second failure SHALL be returned as `ok: false`.
5. A document kind of `unknown` SHALL be returned as `{ ok: false, reason: 'unrecognized_document' }`.

### R5. Local model by default
1. THE extractor SHALL call a local Ollama server using its OpenAI-compatible API, default model `qwen2.5vl:7b`, default base URL `http://localhost:11434/v1`.
2. THE base URL and model name SHALL be overridable by env vars (`EXTRACT_BASE_URL`, `EXTRACT_MODEL`).
3. THE extractor SHALL send page images as base64 data URLs and request JSON output.
4. IF the local server is unreachable, THEN THE extractor SHALL return `{ ok: false, reason: 'model_unreachable' }` and SHALL NOT fall through to Bedrock.
5. THE extractor SHALL use a request timeout from env (`EXTRACT_TIMEOUT_MS`, default 120000).

### R6. Recorded fixtures as zero-key fallback
1. WHEN `EXTRACT_MODE=fixture`, THE extractor SHALL read responses from `packages/notice-extract/fixtures/` and SHALL make no network call and start no browser.
2. THE fixture key SHALL be the sha256 of the original input bytes (the PDF or image file as uploaded, not the rasterized pages).
3. WHEN no fixture matches in fixture mode, THE extractor SHALL return `{ ok: false, reason: 'no_fixture' }`.
4. WHEN `EXTRACT_MODE=record`, THE extractor SHALL call the configured model and write the raw response, with metadata, to `fixtures/`.
5. THE repo SHALL ship one fixture for each acceptance input. Every fixture SHALL come from a real live run through Ollama `qwen2.5vl:7b`. Fixtures SHALL NOT be written or edited by hand. IF a fixture is wrong, THEN it is re-recorded, and the eval reports the error.
6. EACH fixture SHALL store the raw response text, `responseSha256` of that text, `inputSha256`, `provider`, `model`, `recordedAt` and `recordedFrom: 'live'`.
7. THE app SHALL work end to end with no API key and no Ollama when fixtures are used.

### R7. Optional Bedrock
1. WHERE `EXTRACT_PROVIDER=bedrock`, THE extractor SHALL call Claude via Amazon Bedrock.
2. WHEN `EXTRACT_PROVIDER` is unset, THE extractor SHALL use the local provider.
3. THE Bedrock client SHALL be loaded with a lazy dynamic import, only when the Bedrock provider is selected. The AWS SDK SHALL NOT be needed to install, typecheck or test the package.
4. Bedrock credentials and region SHALL come from the standard AWS env vars. THE package SHALL NOT store or log them.
5. THE Bedrock path SHALL use the same prompt, schema and validation as the local path.
6. THE Bedrock path SHALL be tested only with a mocked client. No test SHALL call AWS.
7. WHEN Bedrock is enabled, THE UI SHALL tell the user that the document is sent to a cloud service.

### R8. Privacy
1. THE package SHALL NOT log notice contents, extracted values or model responses.
2. Logs MAY include the document kind, a content hash, durations and error codes.
3. Fixtures SHALL contain synthetic data only.
4. The live-skip message (R12) MAY include the base URL, model name and error code. It SHALL NOT include document content.

### R9. Accuracy measurement
1. THE package SHALL include an eval script that runs the acceptance inputs and compares each extraction with its `fixtures/specimens/*.fields.json` using the compare function (R10). It SHALL report per-field exact-match rate (grouped by field path, with array indexes removed, for example `lines[].hts`), overall exact-match rate, per-input rate, and the share of wrong fields that were flagged `needs_confirmation`.
2. THE eval SHALL run in two modes: `live` (Ollama) and `fixture` (recorded responses, offline).
3. WHEN run live, THE eval SHALL write `packages/notice-extract/eval/results/latest.json` and `packages/notice-extract/eval/results/RESULTS.md`. THE files SHALL be committed. They SHALL record model, date, input sha256 values and the numbers.
4. THE README SHALL quote only numbers copied from `RESULTS.md`. A test SHALL fail when a figure quoted in the README accuracy sentence is not in `latest.json`.
5. THE spec sets no accuracy target. The result is measured and reported as is. A failure to produce schema-valid JSON is a failed acceptance (R11), a low field rate is not.
6. THE fixture-mode eval SHALL reproduce the committed `latest.json` numbers exactly.

### R10. Mapping and comparison with the specimen ground truth
1. THE package SHALL export `toSpecimen(notice, specimenId)`, which unwraps stated fields into the specimen shape without the oracle keys. It SHALL be a pure function that changes no value.
2. THE package SHALL export `compareToSpecimen(extracted, truth)`, which returns one result per leaf path: `{ path, expected, actual, match, confidence, flagged }`. `match` is strict string equality. `flagged` is true when the field was `needs_confirmation`.
3. Lines and fees SHALL be matched by `n` and by index respectively. A missing or extra line or fee SHALL count as wrong fields, not be skipped.
4. THE compare function SHALL ignore the oracle keys in the truth, and SHALL NOT use `expectedDuty` or `expectedFee`.
5. THE compare function SHALL NOT parse, round or normalise numbers. It SHALL be used only by tests and the eval, never to alter an extraction.

### R11. Inputs and live acceptance
1. THE extractor SHALL accept PNG, JPG and PDF. THE type SHALL be detected from the magic bytes, not the file name or the caller's mime. Other types SHALL return `{ ok: false, reason: 'unsupported_input' }`.
2. A PDF SHALL be rasterized locally to one PNG per page before it goes to the model. The default renderer SHALL be pdf.js running in the Playwright Chromium the repo already installs. No PDF bytes SHALL leave the machine.
3. THE rasterizer SHALL use a fixed scale and a page cap (default 5, `EXTRACT_MAX_PAGES`). IF a PDF has more pages, THEN it SHALL return `{ ok: false, reason: 'too_many_pages' }`.
4. A PNG or JPG SHALL be sent as it is, with its own mime type. THE package SHALL NOT crop, deskew or enhance it. The skewed phone photo `specimen-2-form29.photo.jpg` SHALL extract through this path.
5. LIVE ACCEPTANCE: WHEN Ollama with `qwen2.5vl:7b` is available, EACH acceptance input SHALL extract to `ok: true` with schema-valid JSON and the expected `kind`. This is checked by a live integration test.
6. THE eval live run SHALL be the run that records the fixtures (R6.5) and the results file (R9.3).
7. THE package.json SHALL have a script that starts Ollama before the live run (R13).

### R12. Live test never skips silently
1. THE live integration test SHALL probe the server first: `GET {EXTRACT_BASE_URL}/models`, and check that the configured model is listed.
2. IF the probe fails, THEN THE test SHALL log one line with the exact reason, for example the URL and the error code (`ECONNREFUSED`), an HTTP status, or `model qwen2.5vl:7b not installed (installed: ...)`. The log SHALL start with `LIVE SKIPPED:`.
3. THE test SHALL then be skipped by an explicit condition (`describe.skipIf`), so the reporter lists it as skipped with its name. It SHALL NOT pass with zero assertions and SHALL NOT return early inside a test body.
4. WHEN `EXTRACT_LIVE=require` is set, THE probe failure SHALL fail the test instead of skipping. The live run script sets it.
5. THE same rule SHALL apply to any test that needs Playwright Chromium: log the exact reason, skip visibly, fail under `EXTRACT_LIVE=require`.
6. IN fixture mode, THE fixtures test (R6.5, R6.6) SHALL always run, with no Ollama and no Chromium.

### R13. Live run script
1. `packages/notice-extract/package.json` SHALL define `ollama:start` as `systemctl --user start ollama`.
2. IT SHALL define `eval:live`, which runs `ollama:start`, waits until the probe in R12.1 succeeds (up to 60 seconds, then exits non-zero with the reason), then runs the eval in live and record mode with `EXTRACT_LIVE=require` and a longer `EXTRACT_TIMEOUT_MS`.
3. IT SHALL define `eval:fixture` for the offline eval, and `test:live` for the live integration test with `EXTRACT_LIVE=require`.
4. THE default `bun run test` SHALL NOT start Ollama and SHALL NOT need it.

### R14. Fuzz: no throw, no coercion
1. THE package SHALL include a fast-check test that feeds the extractor, through a stub provider, arbitrary strings, arbitrary JSON values, and near-miss versions of a valid notice. Near-miss mutations include a number in place of a money string, a money string with a thousands separator or one decimal, confidence outside 0 to 1, a missing key, an extra key, a wrong `kind`, `actionType` outside the enum, and a null where a value is required with confidence above 0.
2. THE extractor SHALL NOT throw for any input.
3. IF the result is `ok: true`, THEN every stated `value` in the result SHALL be deeply equal to the corresponding value in the parsed model response. No value may be coerced, defaulted, trimmed or reformatted.
4. IF the response breaks the schema, THEN THE result SHALL be `ok: false`.
5. THE test SHALL run with a fixed seed recorded in the test, plus a failing-seed log from fast-check.
