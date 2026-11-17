# Design: tariff-mcp

## Layout
```
packages/tariff-mcp/
  package.json            + scripts test, typecheck; + deps (see Wiring)
  tsconfig.json           like tariff-data: types ["bun"], include src
  src/
    index.ts              TOOL_NAMES only (exists; stays free of bun:sqlite so Vitest can import it)
    index.test.ts         exists, Vitest, unchanged
    server.ts             entry run by mcp.json: createServer(), connect stdio
    context.ts            lazy index handle (openIndex, cached), config from env
    result.ts             ok(), toolError(), figToJson(), parsedRateToJson()
    tools/
      lookup-tariff.ts    schema + handler
      search-rulings.ts
      calculate-duty.ts
      explain-rate.ts
    harness.bun.test.ts   helper: spawn server, return connected Client
    *.bun.test.ts         integration tests (stdio, real index)
packages/tariff-data/src/query/rulings-by-hts.ts   new read-only query (task 5)
```
`bun run packages/tariff-mcp/src/server.ts` runs from the repo root, as in `.kiro/settings/mcp.json`. The server module calls `main()` only when `import.meta.main`, so tools can be imported without starting stdio.

## Wiring
- **SDK**: add `@modelcontextprotocol/sdk` to `packages/tariff-mcp` dependencies. This is a new dependency; `tech.md` names the MCP SDK as the stack and there is no standard-library alternative. Pin the version `bun add` resolves and check it accepts Zod 4 schemas (the repo uses `zod ^4.6.7`). Also add `zod`, `@notice-exorcist/tariff-data` and `@notice-exorcist/duty-engine` as `workspace:*`/existing versions.
- **Why a package tsconfig**: the server imports `tariff-data`, which imports `bun:sqlite`. Root `tsconfig.json` uses `types: ["node"]` and already excludes `packages/tariff-data` for this reason. Add `packages/tariff-mcp` to the root `exclude`, give the package a tsconfig with `types: ["bun"]`, and add `&& tsc -p packages/tariff-mcp` to the root `typecheck` script.
- **Test scripts**: `packages/tariff-mcp` gets `"test": "bun test .bun.test.ts"` (a path filter, so the Vitest-only `index.test.ts` is not run by Bun). The root `test` script gets `&& bun run --cwd packages/tariff-mcp test`. Root Vitest keeps running `index.test.ts`; root `bun test` already ignores `packages/**`.
- `.kiro/settings/mcp.json` is unchanged. `calculate_duty` stays out of `autoApprove`.

## Server
`McpServer` from the SDK with `StdioServerTransport`. Each tool is registered with `registerTool(name, { description, inputSchema }, handler)` using a Zod object shape.

Every handler is wrapped by `safe(handler)`:
```ts
async (args) => {
  try { return await handler(args); }
  catch (e) { return toolError(publicMessage(e)); }
}
```
`publicMessage` maps `IndexNotBuiltError` to its message (it names the index path and `data:build`), engine `InvalidMoneyError` / `MissingProvenanceError` to their messages, and everything else to `internal error in <tool>`. The raw error goes to stderr without arguments.

**Input validation risk.** Depending on the SDK version, a schema failure is either returned as an `isError` result or thrown as a JSON-RPC `InvalidParams` error. R7.1 requires the first. Task 2 pins this with a test. If the installed SDK throws, register the tools on the low-level `Server`, publish `z.toJSONSchema(schema)` in `tools/list`, and run `schema.safeParse` inside `safe()`. The tool modules do not change either way, because each exports `{ name, description, schema, handler }`.

Results are returned as both `content: [{ type: 'text', text: JSON.stringify(result) }]` and `structuredContent: result`, so clients that ignore structured content still get the data.

## Index access
`context.ts` exposes `getDb()`: opens `openIndex()` on first use and caches it. Opening happens inside handlers, so a missing index is a tool error, not a startup crash (R1.5, R7.2). The handle is read-only. Closed on `SIGINT`/`SIGTERM`.

## Tools

### lookup_tariff
```ts
schema: { htsCode: z.string().trim().min(1).max(20) }
```
1. `lookupHts(db, htsCode)`. Non-`ok` status -> `toolError` with structuredContent `{ status, code }`.
2. If the line is 10-digit, `general === ''`, and `lookupHts(db, code.slice(0, 10))` (the 8-digit parent, `XXXX.XX.XX`) is `ok`: use the parent's `general` and `prov`; `walkedUp: true`.
3. Result:
```jsonc
{ "status": "ok", "requestedCode": "6109.10.00.12", "rateSourceCode": "6109.10.00", "walkedUp": true,
  "description": "...", "ancestors": ["..."], "units": "[\"doz.\",\"kg\"]",
  "general": "16.5%", "special": "...", "other": "...",
  "prov": { "kind": "tariff", "source": "...", "hts": "6109.10.00", "edition": "..." } }
```
`description`, `ancestors` and `units` are those of the requested line. `general` and `prov` are those of the line the rate came from. Special and Other are returned as stored on the requested line and are not walked up (the walk-up is only specified for the rate the duty uses).

Not done: walking up from a code that is not in the schedule. A made-up statistical suffix is `not_found`, because inventing a rate for it would be a guess. Walk-up applies only to a real 10-digit line with an empty General column (the behavior `lookup.bun.test.ts` already pins for `6109.10.00.12`).

### search_rulings
```ts
schema: { query: z.string().trim().min(1).max(200).optional(),
          htsPrefix: z.string().trim().max(20).optional(),
          limit: z.number().int().min(1).max(25).default(10) }
  .refine(a => a.query || a.htsPrefix, 'give query, htsPrefix, or both')
```
The prefix is normalized with the same rule as `normalizeHts` (4, 6, 8 or 10 digits, dots optional) to its dotted form (`6109.10`).
- `query` only: `searchRulings(db, query, { limit })`.
- `htsPrefix` only: new `rulingsByHtsPrefix(db, prefix, { limit })` in `tariff-data` (task 5). The MCP package does not write SQL (`structure.md`: tariff-data is the only place that reshapes data). It matches rulings whose stored HTS codes contain a code starting with the dotted prefix and orders newest first.
- both: `searchRulings` with `heading` set from the first four digits, over-fetching (`limit` 50), then filtering `htsCodes` by the prefix and cutting to `limit`.

Result: `{ notice, count, rulings: [{ number, date, title, htsCodes, url, snippet? }] }`. `notice` is a fixed string: "Candidate rulings for review. Not a classification and not legal advice."

### calculate_duty
```ts
const dec = z.string().regex(/^\d+(\.\d+)?$/, 'decimal string like "996.92"');
schema: { enteredValue: dec, htsCode: z.string().optional(), rateText: z.string().max(500).optional(),
          quantity: z.object({ value: dec, unit: z.string().min(1).max(20) }).optional() }
  .refine(a => (a.htsCode === undefined) !== (a.rateText === undefined), 'give exactly one of htsCode, rateText')
```
Flow:
1. Rate source. `htsCode`: shared `resolveRate()` from `lookup-tariff.ts` (same walk-up, same errors); rate text = `general`, `rateProv` = its `tariff` provenance. `rateText`: rate text as given, `rateProv` = `{ kind: 'stated', source: 'calculate_duty input' }`.
2. `parseRateText(text)`, then `computeLineDuty({ rate, rateProv, enteredValue: { value: enteredValue, prov: stated }, quantity })`. Money goes in as decimal strings; the engine's `toMoney` accepts them and rejects anything else.
3. `ok` -> `{ status: 'ok', duty: figToJson(duty), unrounded: toFixed(), formulaId, rate: parsedRateToJson(rate), rateSource: { requestedCode?, rateSourceCode?, walkedUp? } }`.
4. `unsupported` -> `{ status: 'unsupported', raw, reason: reason ?? 'rate_not_supported' }`. No `duty` key. An empty General column (a heading or a statistical line with no parent rate) parses as `unsupported`, so it comes back the same way.

**Engine change (small, in task 8).** `LineInput.rateProv` is typed `TariffProv` in `duty-engine`, but a caller-supplied rate text has no HTS line. Labeling it `tariff` would be false. Widen the type to `TariffProv | StatedProv` (`assertProv` already accepts both) and cover it with an engine test. Alternative if the owner prefers not to touch the engine: make `htsCode` required and drop `rateText` mode from `calculate_duty`; `explain_rate` still covers free rate text. This is the one decision that changes another package, so it is flagged for review before task 8.

### explain_rate
```ts
schema: { rateText: z.string().max(500) }
```
`parseRateText(rateText)` -> `parsedRateToJson`:
- `free`: `{ kind, raw }`
- `ad_valorem`: `{ kind, raw, percent: "6.5" }`
- `specific`: `{ kind, raw, amount: "2.4", currencyUnit: "cents", per: "kg" }`
- `compound`: `{ kind, raw, parts: [specific, ad_valorem] }`
- `unsupported`: `{ kind, raw }`

Plus `prov: { kind: 'stated', source: 'explain_rate input' }`. No model, no prose.

## Serialization (`result.ts`)
`figToJson(fig)` returns `{ value: fig.value.toFixed(), prov: provToJson(fig.prov) }`, recursive over `computed.inputs`. `toFixed()` never emits exponent notation. `parsedRateToJson` uses `toFixed()` for `percent` and `amount`. The package has no `decimal.js` import: values are `Decimal` instances from the engine and only `.toFixed()` is called on them. A boundary test forbids `Number(`, `parseFloat`, `decimal.js` and `process.stdout`/`console.log` in `src` (excluding tests).

## Error model
| Case | Result |
|---|---|
| Zod validation failure | `isError`, message lists failing fields |
| Unknown / invalid / out-of-scope HTS code | `isError`, structuredContent `{ status, code }` |
| Index missing | `isError`, message names `TARIFF_INDEX_PATH` and `data:build` |
| Unsupported rate, unit mismatch, missing quantity | normal result, `status: 'unsupported'` |
| `explain_rate` on unparseable text | normal result, `kind: 'unsupported'` |
| Any other exception | `isError`, short message, server keeps running |

Reasoning: an unsupported rate is a correct answer the caller must handle, like in the engine ("unsupported is a value, not an error"). An unknown code is a failed request.

## Testing
All in `packages/tariff-mcp/src`, `*.bun.test.ts`.
- `harness.bun.test.ts`: `connect(env?)` reads `.kiro/settings/mcp.json`, takes `mcpServers['tariff-mcp']`, spawns with `StdioClientTransport({ command: process.execPath, args, cwd: repoRoot, env })` and returns a connected `Client`. It first checks the index file exists and throws a message naming `bun run --cwd packages/tariff-data data:build` if not.
- Real index only. Fixtures: `6109.10.00` (`16.5%`), `6109.10.00.12` (statistical, empty General, parent `6109.10.00`), `6109.20.00` (not a line), heading `6109` rulings in the CROSS snapshot.
- Expected figures in tests are written as literals worked out by hand (for example `$996.92 x 16.5%` = `164.4918`, `164.49`), or read from the tariff-data raw JSON as `lookup.bun.test.ts` does. They are never produced by calling the code under test.
- Unsupported-rate fixture: `rateText: 'See 9903.88.03'` (parser), plus one real in-scope code whose General column parses as unsupported, found with `bun run rates:sweep` and recorded in the test with a comment.
- One shared server process per test file (`beforeAll`/`afterAll`), a 15 s timeout for spawn.

## Open points
1. Engine `rateProv` widening (above).
2. The tests need a built index (`data:build`), same as the README says for specimens. A tmp-built index would remove the prerequisite but needs `buildIndex` exported from `tariff-data`; not done to keep the package small.
3. `ruling_codes`/`rulings.hts_codes` storage format is read from `search.ts` only (space-separated dotted codes). Task 5 confirms it against the built index.
