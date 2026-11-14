# Requirements: notice-extraction

Package: `packages/notice-extract`. Reads a scan, photo or text of a CBP Form 28, CBP Form 29 or courier duty invoice and returns schema-validated JSON. Every value read here is `stated` (`no-model-math.md`). The model reads. It never computes.

## Terms
- **Stated field**: a value read from the notice, with page, bounding box if available, and confidence.
- **Fixture**: a recorded model response stored in the repo, keyed by the sha256 of the input file.

## Requirements

### R1. Notice schema
1. THE package SHALL define Zod schemas for three document kinds: `cbp_form_28`, `cbp_form_29`, `courier_duty_invoice`, in a discriminated union on `kind`.
2. EACH schema SHALL include header fields (entry number, dates, response deadline where present, importer, port) and an array of line items (description, HTS code as stated, entered value, rate as stated, duty as stated, quantity and unit where present).
3. Form 28 SHALL include the list of information requested. Form 29 SHALL include the action type and each proposed change. The courier invoice SHALL include duty, tax and fee lines with the courier's stated totals.
4. Money SHALL be represented as decimal strings, never JS numbers.
5. EVERY field SHALL be optional only where the form genuinely allows it. A missing required field SHALL be expressed as `null` with confidence `0`, never as a made-up value.

### R2. Stated provenance and confidence
1. EVERY extracted field SHALL be wrapped as `{ value, confidence, page, box?, prov: { kind: 'stated', source } }`.
2. `confidence` SHALL be a number from 0 to 1 reported by the extractor.
3. WHEN confidence is below the configured threshold (default `0.8`), THE package SHALL mark the field `needs_confirmation`.
4. WHEN a field is `needs_confirmation`, THE UI-facing result SHALL expose it so the user must confirm or correct it before it is used in a calculation.
5. THE package SHALL NOT relabel a stated value as `computed`.

### R3. No model math
1. THE extraction prompt SHALL ask only for text, and SHALL NOT ask for totals, sums, conversions or percentages.
2. WHEN the model returns a total that is printed on the notice, THE package SHALL store it as a stated total.
3. THE package SHALL NOT compare, add or round figures. Reconciliation is done by `duty-engine`.
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
1. WHEN `EXTRACT_MODE=fixture`, THE extractor SHALL read responses from `fixtures/` and SHALL make no network call.
2. THE fixture key SHALL be the sha256 of the input bytes.
3. WHEN no fixture matches in fixture mode, THE extractor SHALL return `{ ok: false, reason: 'no_fixture' }`.
4. WHEN `EXTRACT_MODE=record`, THE extractor SHALL call the configured model and write the raw response to `fixtures/` for review.
5. THE repo SHALL ship fixtures for at least one specimen each of Form 28, Form 29 and a courier invoice, using synthetic data only.
6. THE app SHALL work end to end with no API key and no Ollama when fixtures are used.

### R7. Optional Bedrock
1. WHERE `EXTRACT_PROVIDER=bedrock`, THE extractor SHALL call Claude via Amazon Bedrock.
2. WHEN `EXTRACT_PROVIDER` is unset, THE extractor SHALL use the local provider.
3. Bedrock credentials and region SHALL come from the standard AWS env vars. THE package SHALL NOT store or log them.
4. THE Bedrock path SHALL use the same prompt, schema and validation as the local path.
5. WHEN Bedrock is enabled, THE UI SHALL tell the user that the document is sent to a cloud service.

### R8. Privacy
1. THE package SHALL NOT log notice contents, extracted values or model responses.
2. Logs MAY include the document kind, a content hash, durations and error codes.
3. Fixtures SHALL contain synthetic data only.

### R9. Accuracy measurement
1. THE package SHALL include an eval script that runs fixtures against hand-labelled expected JSON and reports per-field exact-match rate and the share of wrong fields that were flagged `needs_confirmation`.
2. THE script SHALL print a result the README can quote. The README SHALL quote only a number the script produced.
