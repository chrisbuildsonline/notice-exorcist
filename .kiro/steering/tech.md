---
inclusion: always
---

# Tech

## Stack
- TypeScript (strict) in a Bun workspaces monorepo.
- `apps/web`: Next.js + Tailwind.
- `packages/duty-engine`: decimal.js, Vitest, fast-check property tests.
- `packages/notice-extract`: Zod schemas for extracted notices.
- `packages/tariff-mcp`: custom MCP server on the MCP TypeScript SDK. Tools: `lookup_tariff`, `search_rulings`, `calculate_duty`, `explain_rate`.
- Rulings and tariff index: SQLite with FTS5.
- Model: local Ollama `qwen2.5vl:7b` through its OpenAI-compatible API. Amazon Bedrock is optional and enabled only by an env var. Local is the default.
- E2E: Playwright.

## Commands (run from repo root)
- `bun run test`: Vitest, including property tests.
- `bun run typecheck`
- `bun run e2e`: Playwright.

Run test and typecheck after every change. Run e2e when UI or the approval flow changes.

## Rules
- Validate all model output with Zod at the boundary. Reject or flag invalid output; never patch it silently.
- Config and secrets come from env vars. Never commit keys or log notice contents.
- Dependency policy: prefer the standard library and dependencies already in the repo. Add a new dependency only when there is no reasonable alternative, and say why.
- Money and rates use decimal.js, never JS floats.
