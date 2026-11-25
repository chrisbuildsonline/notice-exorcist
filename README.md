# Notice Exorcist

Scan the customs notice that haunts your small import business; every duty figure is recomputed by code, never guessed by the model, and every reply is a cited draft you approve.

Built for [Kiroween 2026](https://kiroween.devpost.com/). Submissions close 2026-12-04.

## What it does

A user uploads a PDF, PNG or JPEG of a US customs notice (CBP Form 28, CBP Form 29 or a courier duty invoice), or forwards it to the app's inbound email endpoint. A local vision model reads the header fields and line items into Zod-validated JSON, and fields read with low confidence are held for the user to confirm. Each printed HTS code is looked up in a local index of the USITC tariff schedule, and candidate codes and CBP CROSS rulings are found by full-text search over the goods description; they are shown as cited candidates, never as a classification. A deterministic duty engine recomputes every line duty and the MPF and HMF fees from the values printed on the notice, shows the formula, inputs and rounding for each, and flags where the notice and the recomputation disagree. Each line also gets a short plain-English note; the wording is fixed text chosen by the engine's result, not written by a model. For a notice with a disagreeing line, the app builds a cited reply draft in code (figures and citations are placed from provenance records). The user edits it and ticks an approval bound to the draft's sha256 hash; the server refuses to export anything else. Export is a PDF with the calculation trail and sources. Nothing is filed or sent automatically.

Measured accuracy: 96.3% of fields read exactly right (234 of 243) across five inputs (the three specimen PDFs, plus a PNG and a phone photo of the Form 29) with the local qwen2.5vl:7b model, from 93.6% to 100% per input (the skewed phone photo scored 96.2%); 100% of the wrong fields (9 of 9) were flagged for confirmation.

**In-sample only.** Every figure in this repo, including the accuracy above and the duty and fee results, has been checked only against the three bundled specimen notices and the bundled sample data: 10 HTS chapters, 108 hand-picked CROSS rulings and the fee table in `packages/duty-engine/data/fees.json`. It says nothing about other notices, goods or rate forms. Notice Exorcist is not legal or customs advice; check the current HTS edition and ruling status before relying on any output. Full eval: `packages/notice-extract/eval/results/RESULTS.md`.

## Stack

TypeScript monorepo (Bun workspaces), MIT licensed.

- `apps/web`: Next.js and Tailwind UI and API routes. App data (notices, drafts, approvals) in SQLite through `node:sqlite`. PDF export renders HTML with Playwright's Chromium (`page.pdf`) on the server, with network requests blocked.
- `packages/duty-engine`: pure duty and fee calculation with decimal.js, no I/O. Vitest unit tests and fast-check property tests. MPF and HMF parameters come from a sourced fee table, not constants.
- `packages/notice-extract`: extraction client and Zod schemas. Providers:
  - local Ollama (`qwen2.5vl:7b` through its OpenAI-compatible API), the default for live reads;
  - fixture replay of recorded Ollama replies (`packages/notice-extract/fixtures/`, keyed by the input's sha256), which the web app uses unless `EXTRACT_MODE` is set;
  - Amazon Bedrock (Claude via the Converse API), selected with `EXTRACT_PROVIDER=bedrock`. This path is experimental: it is tested only with a mocked client, the AWS SDK (`@aws-sdk/client-bedrock-runtime`) is an optional peer dependency that is not installed, and the in-app notice that a document goes to a cloud service is not built yet.
- `packages/tariff-data`: fetch and build scripts for a committed snapshot of USITC HTS and CBP CROSS data, and a read-only query API over a SQLite FTS5 index (built locally, not in git).
- `packages/tariff-mcp`: a stdio MCP server on the MCP TypeScript SDK with four tools (`lookup_tariff`, `search_rulings`, `calculate_duty`, `explain_rate`) over the tariff index and the duty engine. It is a development tool for Kiro (see below); the web app reads the same index directly and does not call it.
- `e2e/`: Playwright, with axe-core accessibility checks.

There is no hosted deployment; the app runs locally or in Docker (see Run in Docker). A local-only mode is tested end to end: `e2e/local-mode.spec.ts` runs the specimen flow to an exported PDF on a server whose outbound connections off the machine are refused (`e2e/offline.cjs`).

## Develop

### Run it

No API key and no Ollama: the specimens replay recorded model replies.

```sh
bun install
bun run --cwd packages/tariff-data data:build   # tariff index into packages/tariff-data/.cache/ (offline, not in git)
bunx playwright install chromium                # once: PDF export prints with Chromium
bun run build
bun run start      # http://localhost:3000; another port: bun run start --port 3300
```

Open http://localhost:3000, press Try a specimen, open the Form 29 notice, confirm the flagged values, then Exorcise this notice.

A file without a recording shows "No recorded reading". To read new notices, run Ollama locally with `qwen2.5vl:7b` pulled and start the app with `EXTRACT_MODE=live` (`EXTRACT_BASE_URL` and `EXTRACT_MODEL` override the defaults `http://localhost:11434/v1` and `qwen2.5vl:7b`).

### Work on it

```sh
bun install
bun run --cwd packages/tariff-data data:build   # once, before the tests: they read the index
bun run dev        # web app on http://localhost:3000
bun run test       # Vitest (apps, packages, scripts, test), then bun test for packages/tariff-data, scripts/**/*.bun.test.ts and packages/tariff-mcp
bun run typecheck
bun run e2e        # Playwright (chromium), builds and serves on ports 3210-3212; first run: bunx playwright install chromium

# extraction against a live model (needs Ollama; not part of bun run test)
bun run --cwd packages/notice-extract test:live
bun run --cwd packages/notice-extract eval:live

# tariff data (packages/tariff-data)
bun run --cwd packages/tariff-data data:fetch   # re-download USITC HTS + CBP CROSS into data/ (network)
```

The tariff and ruling data in `packages/tariff-data/data/` is US government public domain, not MIT; see its `SOURCES.md`.

### Run in Docker

The default image serves the app with no key: it installs the dependencies and Playwright Chromium (for the PDF export), builds the tariff index and the Next.js app, and starts it on port 3000 (`-e PORT=...` for another).

```sh
docker build -t notice-exorcist .
docker run --rm -p 3000:3000 notice-exorcist
```

Open http://localhost:3000 and press Try a specimen, as in Run it. The notice store lives in the container, so each `docker run` starts with an empty inbox. With the container up, `bun run docker:check` (on the host, after `bun install`) walks the specimen flow against it with Playwright; `SERVE_URL` points it at another address.

The `test` target runs typecheck, tests and e2e in that order and stops at the first failure:

```sh
docker build --target test -t notice-exorcist-test .
docker run --rm notice-exorcist-test
```

The same commands are in `package.json` as `docker:build`, `docker:serve` and `docker:test`.

## Built with Kiro

The `.kiro/` folder holds the steering, specs, hooks and MCP config used to build this repo.

**Steering** (`.kiro/steering/`). Five files are included in every session: `product.md` (audience, what the app does and never does), `tech.md` (stack, commands, rules such as Zod at the model boundary and decimal.js for money), `structure.md` (package layout and boundaries: duty math only in `duty-engine`, tariff data reshaped only in `tariff-data`), `no-model-math.md` (the model never computes, converts or rounds a figure; every displayed number carries `stated`, `computed` or `tariff` provenance) and `approval-gate.md` (approval bound to the draft hash, server-side 403 on export without it). `design-spooky.md` is included only for files under `apps/web/**` and points at `design/DESIGN.md` for visual values.

**Specs** (`.kiro/specs/`). Seven features, each with `requirements.md` (numbered EARS-style requirements), `design.md` and `tasks.md`: `duty-calculator`, `tariff-data`, `tariff-mcp`, `notice-extraction`, `specimen-notices`, `exorcism-flow` and `accessibility-edge-cases`. Tasks name the test that covers them. 158 tasks are ticked; one is open (`exorcism-flow` task 12, the Bedrock cloud-use notice).

**Hooks** (`.kiro/hooks/`). Four file-edit hooks, each asking the agent to check rather than fix:

- `engine-property-tests`: on edits to `packages/duty-engine/src/**/*.ts`, run the duty-engine Vitest suite, including the fast-check property tests, and report failures with the seed and counterexample.
- `ui-money-literals`: on edits to `apps/web/**/*.tsx`, flag hard-coded currency or percent literals rendered without a provenance record.
- `spec-task-has-test`: on edits to `.kiro/specs/*/tasks.md`, check that every ticked task names a test file that exists.
- `refresh-fixture-index`: on edits to `fixtures/**` or `packages/tariff-data/data/**`, run the tariff-data tests (which build an index from the committed data) and report changes to the fixture list.

`test/kiro-config.test.ts` checks that every hook has the expected shape and that its file patterns match real paths.

**MCP server** (`.kiro/settings/mcp.json`). Registers `tariff-mcp`, started with `bun run packages/tariff-mcp/src/server.ts`, so the agent can look up HTS lines, search the CROSS snapshot, parse rate text and compute a line duty with the real engine instead of doing the math itself. `lookup_tariff`, `search_rulings` and `explain_rate` are auto-approved; `calculate_duty` always asks first, and both `test/kiro-config.test.ts` and `packages/tariff-mcp/src/boundary.bun.test.ts` fail if it is added to `autoApprove`. The MCP integration tests spawn the server with the exact command from `mcp.json` and call each tool against the real index.

**Property-based tests** (fast-check). `packages/duty-engine/src/engine.prop.test.ts` covers the invariants in the duty-calculator spec (R9): duties and fees are never negative, the total equals the sum of its lines and fees with no extra rounding, rounding is half-up to cents exactly once, MPF stays within its fiscal-year minimum and maximum, ad valorem duty never falls as value rises, and every output figure carries valid provenance. `packages/duty-engine/src/rate-text.prop.test.ts` checks that supported rate text parses to the generated values with `raw` kept exactly, and that near-miss strings outside the grammar come back `unsupported` unchanged. `packages/notice-extract` also uses fast-check (`fuzz.test.ts`, `honesty.test.ts`).

## Specimens

Three fictional notices for tests, the empty-Inbox "Try a specimen" action and the demo: a request for information (Form 28 style), a rate-advance notice of action (Form 29 style) with one wrong line duty, and a courier duty invoice with a wrong MPF. Every page is stamped SPECIMEN; names, addresses and entry numbers are invented, and HTS codes and rate text are real lines from the tariff index.

```sh
bun run --cwd packages/tariff-data data:build   # once: the generator checks the index exists
bun run specimens:generate                      # writes fixtures/specimens/ (needs Playwright Chromium)
```

`fixtures/specimens/` holds, per specimen, a PDF, a PNG of page 1 and a `*.fields.json` ground truth (every figure as stated on the document; the two planted errors carry the engine's figure as `expectedDuty` / `expectedFee`), plus `specimen-2-form29.photo.jpg`, a seeded phone photo of the Form 29. The fields JSON is the stable contract; PDF and image bytes can change between runs or Chromium versions. The files are committed and `bun run test` does not regenerate them. The specimens are MIT (see `fixtures/specimens/LICENSE.txt`); the tariff data they quote is public domain.

## License

MIT, see LICENSE.
