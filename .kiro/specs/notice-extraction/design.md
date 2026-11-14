# Design: notice-extraction

## Layout
```
packages/notice-extract/
  src/
    schema/
      field.ts          stated<T>(schema) wrapper: value, confidence, page, box, prov
      common.ts         Money (decimal string), HtsCode, EntryNumber, dates
      form28.ts  form29.ts  courier.ts
      notice.ts         discriminated union on kind
    prompt.ts           System and user prompt, JSON schema hint
    providers/
      types.ts          Provider { complete(req): Promise<string> }
      ollama.ts         OpenAI-compatible chat completions via fetch
      bedrock.ts        Claude via Bedrock Converse API, lazy loaded
      fixture.ts        sha256 -> file lookup
    extract.ts          extractNotice(input) -> ExtractResult
    confidence.ts       markNeedsConfirmation(notice, threshold)
    config.ts           env parsing (Zod)
    index.ts
  fixtures/             recorded responses (.json) + specimen inputs (.png/.pdf), synthetic
  eval/                 labels/*.json and run-eval.ts
  src/**/*.test.ts
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
The model returns `{ value, confidence, page, box }`. The package fills `prov.source` itself from page and box, so the model never writes provenance. Money is `z.string().regex(/^-?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/)`, normalised to a plain decimal string by a deterministic string function, not by the model.

## Flow
1. `extractNotice({ bytes, mime })` hashes the bytes.
2. Config picks a provider: fixture mode, local (default), or Bedrock.
3. PDFs are split into page images by the caller in `apps/web` (using a renderer already in the repo). The package accepts images.
4. Provider returns text. `JSON.parse`, then `Notice.safeParse`.
5. On failure, one retry with issues appended. A second failure returns `ok: false`.
6. `markNeedsConfirmation` sets `needs_confirmation` on fields below the threshold.
7. Result: `{ ok: true, notice, meta: { kind, hash, provider, model } }`.

## Decisions
- **Local first.** Default is Ollama `qwen2.5vl:7b` through the OpenAI-compatible endpoint, called with `fetch`. No SDK dependency.
- **Bedrock is lazy.** The AWS SDK client is imported dynamically only when `EXTRACT_PROVIDER=bedrock`, so the default install path needs no AWS packages loaded. Adding the AWS SDK client is the one new dependency, justified because Bedrock has no practical fetch-only path with SigV4. It is an optional dependency.
- **No silent repair.** Failed validation is a result, not something we patch. This follows `tech.md`.
- **No fall-through between providers.** An unreachable local model does not switch to the cloud. The user chooses cloud with an env var.
- **Fixtures are keyed by input hash**, so tests and demos are deterministic and need no key. Record mode produces them from a real model run, followed by human review.
- **Privacy.** A logger wrapper accepts only whitelisted keys (kind, hash, duration, code).
- **Stated vs computed.** The schema contains only printed values. Differences are made later by `duty-engine`.

## Error results
`ok: false` with `reason` in `not_json | schema_invalid | model_unreachable | no_fixture | unrecognized_document | timeout`.

## Testing
- Schema tests with valid and invalid samples per form.
- Provider tests against a local stub HTTP server (Bun `serve`) that mimics the OpenAI-compatible API.
- Fixture mode test with network blocked.
- Eval script tested on a tiny labelled set.
