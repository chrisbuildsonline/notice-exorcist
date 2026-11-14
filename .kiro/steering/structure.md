---
inclusion: always
---

# Structure

```
apps/web/                 Next.js + Tailwind UI and API routes
packages/duty-engine/     Pure deterministic duty and fee calculation (no I/O)
packages/notice-extract/  Zod schemas and extraction client for notices
packages/tariff-data/     USITC HTS and CBP CROSS data: fetch and build scripts,
                          read-only query API (lookupHts, searchRulings, searchHts)
  data/                   Committed raw downloads (hts/, rulings/, manifest.json,
                          SOURCES.md); source of truth for the index
  .cache/                 Built SQLite index (gitignored)
  test/                   Integration tests on the built index (bun test)
packages/tariff-mcp/      MCP server: lookup_tariff, search_rulings,
                          calculate_duty, explain_rate
design/DESIGN.md          Design tokens for the UI
e2e/                      Playwright tests (or the equivalent config at root)
.kiro/steering/           These steering files
```

## Boundaries
- `duty-engine` has no network, filesystem, or model access. It is the only place duty math lives.
- `notice-extract` defines the shape of data read from a notice. Those values are "stated".
- `tariff-data` is the only place that downloads or reshapes tariff and ruling data. Fetching happens only through `data:fetch`; tests never use the network. It returns rate text verbatim with `tariff` provenance and does no math.
- `tariff-mcp` wraps tariff data, rulings search, and the duty engine. It does no math of its own.
- `apps/web` imports from packages; packages never import from `apps/web`.
- Tests sit beside the code they cover. Property tests for the engine live in `packages/duty-engine`.
- `tariff-data` tests run with `bun test` (not Vitest) and are named `*.bun.test.ts`: unit tests under `src/`, integration tests under `test/`. Vitest excludes `packages/tariff-data/**`.
