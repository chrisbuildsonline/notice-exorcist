# Notice Exorcist

Scan the customs notice that haunts your small import business; every duty figure is recomputed by code, never guessed by the model, and every reply is a cited draft you approve.

Built for [Kiroween 2026](https://kiroween.devpost.com/). Submissions close 2026-12-04.

## What it does

A user uploads a scan or photo of a customs notice. Notice Exorcist extracts every field and line item, rewrites the jargon in plain English, and maps each described product to candidate tariff codes using the official tariff schedule and a searchable archive of past published customs rulings. A deterministic calculator then recomputes the duty and fees line by line, shows the formula for each, and flags where the notice and the recomputation disagree. For each flagged line, it drafts a cited response or protest letter that the user must review and approve before anything is exported as a PDF. Nothing is ever filed automatically. Measured accuracy: 95.5% of fields read exactly right (232 of 243) across five test notices with the local qwen2.5vl:7b model, from 93.6% to 96.2% per notice (the skewed phone photo scored 96.2%); 9.1% of the wrong fields were flagged for confirmation.

## Stack

TypeScript monorepo (Bun workspaces). Next.js and Tailwind front end; a pure packages/duty-engine library using decimal.js with fast-check property tests and Vitest; a notice-extraction service calling a multimodal model (local Ollama by default; Claude via Amazon Bedrock optional, enabled by an env var) that returns schema-validated JSON (Zod); SQLite with FTS5 for the local rulings index; a custom MCP server (tariff-mcp) built on the MCP TypeScript SDK; PDF export with a server-side renderer. Deployed as one Docker Compose file or a single hosted app, with an optional local-only mode. OSI-licensed (MIT) public repository.

## Develop

```sh
bun install
bun run dev        # web app on http://localhost:3000
bun run test       # Vitest across all workspaces, then bun test for packages/tariff-data and *.bun.test.ts
bun run typecheck
bun run e2e        # Playwright (chromium); first run: bunx playwright install chromium

# tariff data (packages/tariff-data)
bun run --cwd packages/tariff-data data:fetch   # re-download USITC HTS + CBP CROSS into data/ (network)
bun run --cwd packages/tariff-data data:build   # build the SQLite FTS5 index into .cache/ (offline)
```

The tariff and ruling data in `packages/tariff-data/data/` is US government public domain, not MIT; see its `SOURCES.md`.

## Specimens

Three fictional notices for tests, the empty-Inbox "Try a specimen" action and the demo: a request for information (Form 28 style), a rate-advance notice of action (Form 29 style) with one wrong line duty, and a courier duty invoice with a wrong MPF. Every page is stamped SPECIMEN; names, addresses and entry numbers are invented, and HTS codes and rate text are real lines from the tariff index.

```sh
bun run --cwd packages/tariff-data data:build   # once: the generator checks the index exists
bun run specimens:generate                      # writes fixtures/specimens/ (needs Playwright Chromium)
```

`fixtures/specimens/` holds, per specimen, a PDF, a PNG of page 1 and a `*.fields.json` ground truth (every figure as stated on the document; the two planted errors carry the engine's figure as `expectedDuty` / `expectedFee`), plus `specimen-2-form29.photo.jpg`, a seeded phone photo of the Form 29. The fields JSON is the stable contract; PDF and image bytes can change between runs or Chromium versions. The files are committed and `bun run test` does not regenerate them. The specimens are MIT (see `fixtures/specimens/LICENSE.txt`); the tariff data they quote is public domain.

## License

MIT, see LICENSE.
