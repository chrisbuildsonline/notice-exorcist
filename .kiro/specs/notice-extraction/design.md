# Design: notice-extraction

## Layout
```
packages/notice-extract/
  src/
    schema/
      field.ts          stated<T>(schema) wrapper: value, confidence, page, box, prov
      common.ts         Money, Dec, Iso, HtsCode (same patterns as scripts/specimens/schema.ts)
      base.ts           header, line, fee, statedTotal schemas shared by all kinds
      form28.ts  form29.ts  courier.ts
      notice.ts         discriminated union on kind
    map/
      toSpecimen.ts     unwrap stated fields to the specimen shape
      compare.ts        compareToSpecimen(extracted, truth) -> per-path results
    input/
      sniff.ts          magic-byte detection: png | jpeg | pdf
      rasterize.ts      PDF -> PNG pages (pdf.js in Playwright Chromium)
    prompt.ts           System and user prompt, JSON schema hint
    providers/
      types.ts          Provider { complete(req): Promise<string> }
      ollama.ts         OpenAI-compatible chat completions via fetch
      bedrock.ts        Claude via Bedrock Converse API, lazy loaded
      fixture.ts        sha256 -> file lookup, and record writer
    live/
      probe.ts          probeOllama(), waitForOllama(), liveGate() (skip or fail)
    extract.ts          extractNotice(input) -> ExtractResult
    confidence.ts       markNeedsConfirmation(notice, threshold)
    config.ts           env parsing (Zod)
    index.ts
  fixtures/             recorded live responses, <inputSha256>.json
  eval/
    run-eval.ts         live and fixture modes
    results/            latest.json, RESULTS.md (committed)
  src/**/*.test.ts
fixtures/specimens/     (repo root) inputs and ground truth; read, never copied
```

## Schema shape
```ts
const Stated = <T extends z.ZodTypeAny>(v: T) => z.object({
  value: v.nullable(),
  confidence: z.number().min(0).max(1),
  page: z.number().int().positive(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  prov: z.object({ kind: z.literal('stated'), source: z.string() }),
});
```
The model returns `{ value, confidence, page, box }`. The package fills `prov.source` itself from page and box, so the model never writes provenance.

The notice body mirrors the specimen schema key for key, with each leaf wrapped in `Stated`:

| Specimen key | Extraction |
|---|---|
| `kind` | literal per variant, plain (not wrapped), used as the union discriminator |
| `noticeType`, `entryNumber`, `port` | `Stated(string)` (`port` nullable) |
| `actionType` | `Stated(z.enum(['rate_advance']))`. Required value on `cbp_form_29`, value `null` on the others |
| `dates.{entry,notice,responseDeadline}` | `Stated(Iso)` |
| `importer.{name,address}` | `Stated(string)` |
| `courier.{name,invoiceNumber,waybill}` | object of `Stated(string)`, required on `courier_duty_invoice`, `null` on the others |
| `informationRequested` | array of `Stated(string)`, non-empty on `cbp_form_28`, empty on the others |
| `lines[]` | `n`, `description`, `hts`, `value`, `quantity`, `unit`, `rateText`, `dutyStated`, each `Stated` |
| `fees[]` | `name`, `kind` (`mpf`, `hmf`, `courier_fee`), `stated` |
| `statedTotals[]` | `name`, `stated` |

Left out: the oracle keys `specimenId`, `notes`, `plantedError`, `expectedDuty`, `expectedFee`. None is printed on a document.

Enums and regexes are duplicated from the specimen schema, not imported, because `packages/` does not depend on `scripts/`. `schema-parity.test.ts` imports both and fails on drift: it compares the key tree of the extraction schema with the specimen schema minus the oracle keys, the `kind`, `actionType` and fee `kind` enums, and the source of each regex.

Money is `z.string().regex(/^-?\d+\.\d{2}$/)`, exactly the specimen format. There is no normalisation step. If the model returns `3,240.00` or `3240`, validation fails and the retry carries the issue. This removes the one place the package could rewrite a value, which keeps the fuzz property in R14.3 simple.

## Mapping and compare
- `toSpecimen(notice, specimenId)`: walks the validated notice, takes `.value` of each stated field, and returns an object that parses with the specimen `Fields` schema minus the oracle keys. Pure. `specimenId` is passed in because it is not on the document.
- `compareToSpecimen(extracted, truth)`: flattens both sides to leaf paths (`lines[2].hts`, `dates.notice`, `fees[0].stated`). Lines are matched by `n`, fees and totals by index, `informationRequested` by index. For each path in the union of both sides it returns `{ path, expected, actual, match, confidence, flagged }`. A path present on one side only is `match: false`. `match` is `expected === actual`. Oracle keys in the truth are dropped first.
- The eval groups results by path with indexes removed (`lines[].hts`) to give a per-field rate.

## Inputs and rasterizing
1. `sniff(bytes)` checks magic bytes: `89 50 4E 47` PNG, `FF D8 FF` JPEG, `%PDF-` PDF. Anything else is `unsupported_input`.
2. PNG and JPEG go to the provider unchanged as `data:image/png;base64,...` or `data:image/jpeg;base64,...`. No crop, deskew or enhancement. The phone photo takes this path. If the 7b model does badly on it, the eval shows that, and no pre-processing is added without a new decision.
3. PDF goes to `rasterize(bytes)`: launch Playwright Chromium (already installed for e2e), open a blank page, load `pdfjs-dist` from `node_modules` into it, render each page to a canvas at scale 2, and return `canvas.toDataURL('image/png')` bytes. Pages over `EXTRACT_MAX_PAGES` (default 5) return `too_many_pages`. The browser is closed in a `finally`. Nothing is fetched from the network: the pdf.js script and worker are read from disk.
4. The only new dependency is `pdfjs-dist`. Reason: Chromium cannot export a page image from its built-in PDF viewer when headless, and there is no PDF renderer in the repo. `playwright` is already in the repo. Fallback if pdf.js proves unusable: `pdftoppm` (poppler) behind the same `rasterize` interface, decided in a PR.
5. Fixture mode hashes the original input bytes before sniffing pages or starting a browser, so offline runs need neither Chromium nor Ollama.

## Flow
1. `extractNotice({ bytes })` hashes the bytes, then sniffs the type.
2. Config picks a provider: fixture mode, local (default), or Bedrock.
3. In fixture mode: look up the hash, parse the stored raw response, go to step 6.
4. Otherwise: PDF is rasterized, images are sent to the provider.
5. Provider returns text. In record mode the raw text is written to `fixtures/<hash>.json` with metadata.
6. `JSON.parse`, then `Notice.safeParse`. On failure, one retry with issues appended (not in fixture mode). A second failure returns `ok: false`.
7. `markNeedsConfirmation` sets `needs_confirmation` on fields below the threshold.
8. Result: `{ ok: true, notice, meta: { kind, hash, provider, model } }`.

## Fixture format
```json
{
  "inputSha256": "...", "responseSha256": "...", "raw": "<model response text>",
  "provider": "ollama", "model": "qwen2.5vl:7b",
  "recordedAt": "2026-11-15T...", "recordedFrom": "live"
}
```
Only record mode writes this file. `fixtures.test.ts` checks that `responseSha256` matches `raw` and that `inputSha256` matches the file name and the input in `fixtures/specimens/`. A hand edit of `raw` breaks the hash check. A hand edit of both would not be detected by the test. Review of the git diff is the control for that, and the recording commit contains only output of `eval:live`.

## Live gate
`live/probe.ts`:
- `probeOllama({ baseUrl, model })` does `GET {baseUrl}/models` with a 3 s timeout. It returns `{ up: true }` or `{ up: false, reason }`. `reason` is one line: `GET http://localhost:11434/v1/models failed: ECONNREFUSED`, `... returned HTTP 500`, or `model qwen2.5vl:7b not installed (installed: a, b)`.
- `liveGate(name)` runs at module top level of a live test file. If the probe is down: with `EXTRACT_LIVE=require` it throws (the suite fails). Otherwise it writes `LIVE SKIPPED: <name>: <reason>` to stderr and returns `{ skip: true }`. The test file uses `describe.skipIf(gate.skip)`, so the report shows the suite as skipped, not passed.
- `waitForOllama(timeoutMs)` polls the probe every second. It is used by `eval:live`.
- The same helper takes a `needs: 'ollama' | 'chromium'` argument. The Chromium probe tries `chromium.executablePath()` and checks that the file exists.

## Scripts (`packages/notice-extract/package.json`)
```json
{
  "ollama:start": "systemctl --user start ollama",
  "eval:fixture": "bun run eval/run-eval.ts --mode fixture",
  "eval:live": "bun run ollama:start && bun run src/live/wait.ts && EXTRACT_LIVE=require EXTRACT_MODE=record EXTRACT_TIMEOUT_MS=600000 bun run eval/run-eval.ts --mode live",
  "test:live": "bun run ollama:start && bun run src/live/wait.ts && EXTRACT_LIVE=require EXTRACT_TIMEOUT_MS=600000 vitest run src/live"
}
```
The unit test for scripts only checks the strings, it never runs `systemctl`. If `ollama` is a system service and not a user service, the command fails with systemd's message and the script stops there, before any model call.

## Eval output
`run-eval.ts` loops over the acceptance inputs, calls `extractNotice`, then `toSpecimen` and `compareToSpecimen` against `fixtures/specimens/<id>.fields.json`. It records for each input: sha256, `ok`, `reason` if not ok, schema-valid yes or no, matched and total field counts, and the wrong fields with their flagged status. Aggregates: per-path rate, overall rate, flagged share of wrong fields. An input that fails extraction counts all its truth fields as wrong and is listed as a failure.

`latest.json` holds the data. `RESULTS.md` is rendered from it with a plain template: a table per input, a table per field path, the overall figure. The README sentence "Measured accuracy: ..." is filled by copying from `RESULTS.md`. `readme.test.ts` extracts the percentages from that sentence and requires each to equal a value in `latest.json`.

Fixture mode reads the committed fixtures, so it needs no model, and its output must equal `latest.json` field for field (except `generatedAt`). `results.test.ts` checks this, so the README number is reproducible offline.

## Decisions
- **Local first.** Default is Ollama `qwen2.5vl:7b` through the OpenAI-compatible endpoint, called with `fetch`. No SDK dependency.
- **Specimen schema is the contract.** The extraction schema is the specimen schema with stated wrappers. Compare is a plain function over leaf paths, so a wrong field is visible by name.
- **Bedrock is lazy and injectable.** `providers/bedrock.ts` takes `loadClient = () => import('@aws-sdk/client-bedrock-runtime')`. The default loader is used only when `EXTRACT_PROVIDER=bedrock`. Tests pass a mock loader, so the AWS SDK is not installed for tests and `vi.mock` of a missing module is avoided. The SDK is the one optional dependency, justified because Bedrock has no practical fetch-only path with SigV4.
- **No silent repair.** Failed validation is a result, not something we patch. This follows `tech.md`.
- **No fall-through between providers.** An unreachable local model does not switch to the cloud. The user chooses cloud with an env var.
- **Fixtures are keyed by input hash** of the original upload, so tests and demos are deterministic and need no key. They come only from `EXTRACT_MODE=record` during a live run.
- **Live tests skip loudly.** A visible `skipIf` and a logged reason, and a hard fail under `EXTRACT_LIVE=require`. A test that passes without asserting is not allowed.
- **Privacy.** A logger wrapper accepts only whitelisted keys (kind, hash, duration, code).
- **Stated vs computed.** The schema contains only printed values. Differences are made later by `duty-engine`.

## Error results
`ok: false` with `reason` in `not_json | schema_invalid | model_unreachable | no_fixture | unrecognized_document | timeout | unsupported_input | too_many_pages`.

## Testing
- Schema tests with valid and invalid samples per form, and a test that each `*.fields.json`, wrapped in stated fields by a test helper, parses.
- Schema parity test against `scripts/specimens/schema.ts`.
- Compare and mapping tests with single-field perturbations.
- Provider tests against a local stub HTTP server (Bun `serve`) that mimics the OpenAI-compatible API.
- Rasterizer test on the three specimen PDFs (needs Chromium, visible skip otherwise).
- Fixture mode test with network blocked.
- Fuzz test with fast-check through a stub provider.
- Bedrock test with an injected mock loader.
- Live integration test on the five acceptance inputs (needs Ollama, visible skip otherwise).
- Eval tested on a tiny labelled set, and the committed results checked against the fixtures offline.
