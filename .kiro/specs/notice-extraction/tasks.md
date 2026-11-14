# Tasks: notice-extraction

Run `bun run test` and `bun run typecheck` after each task. Each task names the test that proves it.

- [ ] 1. Scaffold `packages/notice-extract` (workspace member, strict TS, Vitest, zod). Add `field.ts` with the `Stated` wrapper and `common.ts` types (decimal-string money, HTS code, entry number).
  - Test: `field.test.ts` accepts a valid stated field and rejects confidence outside 0 to 1, a numeric money value, and a missing page. Covers R1.4, R2.1, R2.2.
- [ ] 2. Define `form29.ts` (action type, proposed changes with per-line fields) and the `notice.ts` union.
  - Test: `form29.test.ts` parses a valid sample and rejects one missing the entry number unless it is `null` with confidence 0. Covers R1.1, R1.2, R1.3, R1.5.
- [ ] 3. Define `form28.ts` (information requested list, response deadline).
  - Test: `form28.test.ts` valid and invalid samples. Covers R1.1, R1.3.
- [ ] 4. Define `courier.ts` (duty, tax, fee lines, courier stated totals).
  - Test: `courier.test.ts` valid sample, and a check that the schema has no field not printed on the document, such as a recomputed total (key-list snapshot). Covers R1.3, R3.2, R3.4.
- [ ] 5. Add `confidence.ts` with `markNeedsConfirmation` and a configurable threshold.
  - Test: `confidence.test.ts` marks 0.79 and 0 as needing confirmation and 0.8 as not, with a custom threshold. Covers R2.3, R2.4.
- [ ] 6. Add `config.ts` parsing env vars (`EXTRACT_PROVIDER`, `EXTRACT_MODE`, `EXTRACT_BASE_URL`, `EXTRACT_MODEL`, `EXTRACT_TIMEOUT_MS`) with defaults.
  - Test: `config.test.ts` defaults are local, `qwen2.5vl:7b`, `http://localhost:11434/v1`, 120000, and invalid values throw. Covers R5.1, R5.2, R5.5, R7.2.
- [ ] 7. Write `prompt.ts` asking for text only.
  - Test: `prompt.test.ts` asserts the prompt contains no request for total, sum, convert, percentage or approximate (word-list check), and includes the JSON shape. Covers R3.1.
- [ ] 8. Implement `providers/ollama.ts` using `fetch`, base64 image data URLs, JSON output, and a timeout.
  - Test: `ollama.test.ts` runs against a stub HTTP server and checks the request body (model, image data URL, response format) and the timeout result. Covers R5.1, R5.3, R5.5.
- [ ] 9. Implement `extract.ts` with validate, one retry, and typed failures.
  - Test: `extract.test.ts` with a stub provider: valid response is `ok`, non-JSON gives `not_json`, invalid shape retries once with issues in the prompt then returns `schema_invalid`, `unknown` kind gives `unrecognized_document`, and no value is defaulted or coerced. Covers R4.1 to R4.5.
- [ ] 10. Handle an unreachable local server without cloud fall-through.
  - Test: `unreachable.test.ts` points at a closed port with Bedrock env vars set but provider unset, expects `model_unreachable` and no Bedrock call (spy on the lazy import). Covers R5.4.
- [ ] 11. Implement `providers/fixture.ts` and `EXTRACT_MODE` fixture and record modes.
  - Test: `fixture.test.ts` with network blocked: hit returns the recorded notice, miss returns `no_fixture`, record mode writes a file to a temp dir. Covers R6.1 to R6.4.
- [ ] 12. Create synthetic specimen inputs and recorded fixtures for Form 28, Form 29 and a courier invoice. Review each by hand.
  - Test: `fixtures.test.ts` loads each fixture, validates against the schema, and asserts that the stated totals are present as stated fields. Covers R6.5, R8.3.
- [ ] 13. Implement `providers/bedrock.ts` with a dynamic import, enabled only by `EXTRACT_PROVIDER=bedrock`. Add the AWS SDK Bedrock runtime client as an optional dependency and record the reason in the PR.
  - Test: `bedrock.test.ts` with a mocked client checks it uses the same prompt and schema, that unset provider never imports it, and that credentials never appear in thrown errors. Covers R7.1 to R7.4.
- [ ] 14. Expose `meta.provider` so the UI can show the cloud-use notice when Bedrock is on.
  - Test: `meta.test.ts` checks `meta.provider` is `ollama`, `fixture` or `bedrock`. The UI assertion lives in the exorcism-flow Playwright test. Covers R7.5.
- [ ] 15. Add the privacy-safe logger wrapper.
  - Test: `logger.test.ts` runs a full extraction with a spy on console and asserts no notice value, response text or key appears in output. Covers R8.1, R8.2.
- [ ] 16. Add `eval/run-eval.ts` and hand-labelled expected JSON for the fixtures.
  - Test: `eval.test.ts` runs on a two-field labelled set and checks exact-match rate and flagged-wrong share. Covers R9.1, R9.2.
- [ ] 17. Add a stated-only guard: no code path in the package produces `computed` provenance.
  - Test: `stated-only.test.ts` greps package sources for `'computed'` and fails on any hit outside tests. Covers R2.5, R3.3.
