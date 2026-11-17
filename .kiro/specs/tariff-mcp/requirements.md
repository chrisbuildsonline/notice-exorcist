# Requirements: tariff-mcp

Package: `packages/tariff-mcp`. A stdio MCP server that exposes the tariff index, the rulings index and the duty engine as four tools. It does no math and holds no tariff data of its own (`structure.md`, `no-model-math.md`).

## Terms
- **Index**: the SQLite FTS5 file built by `packages/tariff-data` (`data:build`). Path from `TARIFF_INDEX_PATH`, default `packages/tariff-data/.cache/tariff.sqlite`.
- **Rate text**: the HTS "General" column string, verbatim (`Free`, `16.5%`, `2.4¢/kg + 5%`).
- **Statistical line**: a 10-digit HTS line. Many carry an empty General column; the rate lives on the 8-digit parent.
- **Tool error**: a tool result with `isError: true` and a text message. Never a process crash and never a dropped connection.
- **Unsupported**: the duty engine's honest answer for a rate it cannot compute. It is a normal result, not a tool error.

## Requirements

### R1. Server and transport
1. THE server SHALL be a stdio MCP server built on `@modelcontextprotocol/sdk`, started by `bun run packages/tariff-mcp/src/server.ts` (the command in `.kiro/settings/mcp.json`).
2. THE server SHALL list exactly four tools, in this order: `lookup_tariff`, `search_rulings`, `calculate_duty`, `explain_rate`, matching `TOOL_NAMES` in `src/index.ts`.
3. EACH tool SHALL declare a Zod input schema, published to clients as JSON Schema.
4. THE server SHALL write only MCP protocol messages to stdout. Diagnostics go to stderr and never include notice contents.
5. THE server SHALL start without the index present. Index problems surface as tool errors when a tool needs the index (R7.2).

### R2. lookup_tariff
Input: `{ htsCode: string }` (4, 6, 8 or 10 digits, dots optional).
1. WHEN the code is a line in the index, THE tool SHALL return `code`, `description`, `ancestors`, `units`, and the General, Special and Other rate text exactly as stored, plus a `tariff` provenance record (source, HTS code, edition).
2. WHEN the code is a 10-digit statistical line whose General rate text is empty and its 8-digit parent exists, THE tool SHALL return the parent's rate text and provenance, and SHALL report `requestedCode`, `rateSourceCode` and `walkedUp: true`.
3. WHEN the line has its own General rate text, THE tool SHALL NOT walk up, and SHALL report `walkedUp: false`.
4. THE tool SHALL NOT parse, convert or infer a rate. A line with no rate text and no 8-digit parent returns an empty rate text.
5. WHEN the code is malformed, outside the indexed chapters, or not a line in the schedule, THE tool SHALL return a tool error whose structured content has `status` of `invalid_code`, `out_of_scope` or `not_found` and the code as given.

### R3. search_rulings
Input: `{ query?: string, htsPrefix?: string, limit?: number }`. At least one of `query` and `htsPrefix` is required. `limit` is an integer from 1 to 25, default 10.
1. WHEN `query` is given, THE tool SHALL return CROSS rulings ranked by the index's relevance order.
2. WHEN `htsPrefix` is given, THE tool SHALL return only rulings that cite at least one HTS code beginning with that prefix (4, 6, 8 or 10 digits, dots optional).
3. WHEN both are given, THE tool SHALL apply both.
4. EACH ruling SHALL carry `number`, `date`, `title`, `htsCodes` and `url`. `snippet` is included when `query` is given.
5. THE tool SHALL label results as candidates: the result has a `notice` field stating that rulings are citations to review, not a classification.
6. WHEN nothing matches, THE tool SHALL return an empty list and no error.

### R4. calculate_duty
Input: `{ enteredValue: string, htsCode?: string, rateText?: string, quantity?: { value: string, unit: string } }`. Exactly one of `htsCode` and `rateText` is required.
1. THE tool SHALL accept money and quantities only as decimal strings (`/^\d+(\.\d+)?$/`). A JS number SHALL fail input validation (R7.1).
2. WHEN `htsCode` is given, THE tool SHALL look up the rate as in R2 (including the walk-up) and compute with that rate text and its `tariff` provenance.
3. WHEN `rateText` is given, THE tool SHALL parse and compute with it as is. The provenance of that rate is `stated`, source "calculate_duty input".
4. THE tool SHALL call `parseRateText` and `computeLineDuty` from `@notice-exorcist/duty-engine` and SHALL NOT add, multiply, round or convert any figure itself.
5. WHEN the engine returns `ok`, THE tool SHALL return `status: 'ok'`, `duty`, `unrounded`, `formulaId`, the parsed rate, and the full provenance tree (`computed` with inputs, each with its own provenance and the rounding rule). Every figure is a decimal string.
6. WHEN the engine returns `unsupported` (unparseable rate text, `unit_mismatch`, `missing_quantity`), THE tool SHALL return `status: 'unsupported'` with `raw` and `reason`, and SHALL NOT include any duty field. It SHALL NOT substitute another rate.
7. WHEN `htsCode` fails lookup (R2.5), THE tool SHALL return the same tool error as `lookup_tariff`.
8. THE entered value SHALL carry `stated` provenance, source "calculate_duty input".

### R5. explain_rate
Input: `{ rateText: string }`.
1. THE tool SHALL return the result of the duty engine's `parseRateText`, serialized: `kind`, `raw` (verbatim) and the kind's fields (`percent`, or `amount`, `currencyUnit`, `per`, or both parts for compound), numbers as decimal strings.
2. WHEN the rate text is not supported, THE tool SHALL return `kind: 'unsupported'` with `raw`, not a tool error.
3. THE tool SHALL NOT call a model and SHALL NOT add prose that restates the figures.

### R6. Figures and provenance
1. EVERY figure in any tool result SHALL be a decimal string. THE server SHALL NOT emit a JS number for money, rates, percentages or quantities (counts such as `limit` excepted).
2. EVERY figure SHALL come with a provenance record of kind `stated`, `computed` or `tariff`.
3. THE tool descriptions SHALL say that the model must quote figures from results and must not recompute them.

### R7. Errors
1. WHEN tool input fails its Zod schema, THE server SHALL return a tool error that names the invalid field. It SHALL NOT throw out of the handler.
2. WHEN the index is missing or unreadable, THE tool SHALL return a tool error that names `TARIFF_INDEX_PATH` and `data:build`.
3. WHEN any other exception occurs in a handler, THE server SHALL return a tool error with a short message and keep serving.
4. A tool error SHALL NOT include a stack trace or an absolute path other than the index path.

### R8. Approval and boundaries
1. `calculate_duty` SHALL NOT be added to `autoApprove` in `.kiro/settings/mcp.json` (enforced by `test/kiro-config.test.ts`).
2. THE package SHALL NOT import `decimal.js`, the network, or `apps/web`. It reads the index read-only.
3. THE tools produce candidates and figures for the user to review. None of them files, sends or approves anything.

### R9. Tests and wiring
1. THE integration test SHALL spawn the server over stdio with the SDK `Client`, using the command and args from `.kiro/settings/mcp.json`, list exactly four tools, and call each against the real index. No mocks.
2. THE suite SHALL include one test for an unknown HTS code and one for an unsupported rate.
3. THE tests SHALL run under `bun test` (they need `bun:sqlite`) as `*.bun.test.ts`, and run in root `bun run test`.
4. THE package SHALL typecheck under root `bun run typecheck`.
5. THE tests SHALL fail with a message naming `data:build` when the index has not been built. They SHALL NOT skip.
