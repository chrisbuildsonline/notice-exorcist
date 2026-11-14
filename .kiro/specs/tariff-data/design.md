# Design: tariff-data

## Layout
```
packages/tariff-data/
  package.json          scripts: data:fetch, data:build, test (bun test)
  src/
    config.ts           Scope chapters, per-heading ruling cap, rate limit, paths, env
    codes.ts            normalizeHts, isInScope, chapterOf, headingOf
    schemas.ts          Zod: HtsExportRow, CrossRuling, Manifest
    fetch/
      hts.ts            Download one chapter export
      cross.ts          Search and download rulings
      run.ts            Entry for `bun run data:fetch`
      sources-note.ts   Regenerate edition/date lines in SOURCES.md
    build/
      schema.sql        Tables, FTS5, triggers-free (content loaded once)
      run.ts            Entry for `bun run data:build`
    query/
      db.ts             openIndex(path) (read-only)
      lookup.ts         lookupHts
      search.ts         searchRulings, searchHts, toFtsExpression
      index.ts          Public API and types
  data/
    SOURCES.md          Hand-written licence note plus generated edition lines
    manifest.json       Edition, URLs, timestamps, per-file sha256
    hts/ch39.json ...   Raw USITC exports, one per scope chapter
    rulings/N312345.json ...   Raw CROSS records
  .cache/tariff.sqlite  Build output (gitignored)
  src/**/*.test.ts      Unit tests (bun test)
  test/*.bun.test.ts    Integration tests on the built index (bun test)
```
`structure.md` does not list `packages/tariff-data` yet. Add it there when this spec is implemented (this spec only writes under `.kiro/specs/tariff-data/`).

## Data sources
Endpoints below come from the public sites and must be confirmed in task 1 before code depends on them. If one differs, update this file.
- **HTS.** USITC exposes a REST export at `https://hts.usitc.gov/reststop/exportList?from=<code>&to=<code>&format=JSON&styles=false`. For chapter `CC` the script requests `from=CC00` and `to=CC99`. Each row has `htsno`, `indent`, `description`, `superior`, `units`, `general`, `special`, `other` and footnote fields. The edition comes from the HTS release page, and the script records it by hand-supplied flag `--edition "2026 Revision 7"` if it cannot be read from the response.
- **CROSS.** CBP's CROSS site (`https://rulings.cbp.gov`) has a JSON search API behind its UI. The script searches by HTS heading, then fetches each ruling record. Ruling URLs of the form `https://rulings.cbp.gov/ruling/N312345` are stored as `url`.
- Both are US government works. `SOURCES.md` says so and asks users to check the current edition.

## Decisions
- **Raw files are the source of truth.** The fetch script stores responses untouched. The build script is the only place that reshapes data. Reviewers can diff a re-download against the snapshot.
- **Committed snapshot, uncommitted index.** Tests run offline from the snapshot and build a fresh index into a temp directory. No test depends on a stale binary file. Size check in task 4: if the snapshot exceeds 25 MB, cap rulings per heading lower.
- **Verbatim rate text.** `general`, `special`, `other`, `units` pass from Zod-validated JSON into SQLite as strings with no transform. The query module returns them as stored, with a `tariff` provenance record. Parsing is `duty-engine`'s job, and it returns `unsupported` for odd text, so the data layer need not understand it.
- **No rate inheritance.** Many HTS lines have an empty `general` because the rate is on the 10-digit child. The lookup returns what the line says. Walking to a parent or child for a rate would be a guess.
- **Heading rows.** Rows without `htsno` are kept (they hold the description hierarchy). They have `code = ''` and are excluded from code lookup. `seq` preserves source order, and ancestors are found by walking backwards to the nearest row with a lower `indent`.
- **Code normalization.** Strip non-digits, then format `NNNN`, `NNNN.NN`, `NNNN.NN.NN`, `NNNN.NN.NN.NN`. Lengths other than 4, 6, 8 or 10 digits are invalid. Statistical suffix lines are 10-digit codes. Lookup of a 10-digit code matches exactly.
- **Out of scope vs not found.** Chapter is the first two digits. If it is a valid chapter (01 to 97) but not in scope, the answer is `out_of_scope`, so callers do not read it as "this code is not in the tariff".
- **FTS5 setup.** External-content-free FTS5 tables (`hts_fts`, `rulings_fts`) filled in the same transaction as the base tables, with `tokenize = 'porter unicode61 remove_diacritics 2'`. Porter stemming lets `shirts` match `shirt`, and unicode61 splits `T-shirt` into `t` and `shirt`, matching how the query is tokenized. `rulings_fts` indexes `title` and `text`, with `title` weighted higher in `bm25(rulings_fts, 5.0, 1.0)`.
- **Safe queries.** `toFtsExpression("cotton t-shirt knitted")` gives `"cotton" AND "t" AND "shirt" AND "knitted"`. Single-letter token `t` is kept because dropping it would change meaning for terms like `t-shirt`. AND first, OR fallback when empty. Tokens are always double-quoted, with no user text reaching FTS5 syntax.
- **Ruling codes.** CROSS rulings list HTS numbers in free text and in a field. The build extracts codes from the structured field when present, otherwise from a regex over `\b\d{4}\.\d{2}(\.\d{2}){0,2}\b` in the record's tariff field only, not the body, so a ruling that merely mentions another code is not filed under it. Each is normalized and stored in `ruling_codes` with its heading.
- **Read-only at query time.** `openIndex` opens with `{ readonly: true }`.
- **Dependencies.** Only `zod`. Bun provides `fetch`, `bun:sqlite` and the test runner.

## Schema
```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE hts_lines (
  seq INTEGER PRIMARY KEY,           -- source order across all chapters
  chapter TEXT NOT NULL,             -- '39', '61', ...
  code TEXT NOT NULL,                -- '6109.10.00.12' or '' for heading rows
  indent INTEGER NOT NULL,
  description TEXT NOT NULL,
  general TEXT NOT NULL,             -- verbatim
  special TEXT NOT NULL,
  other TEXT NOT NULL,
  units TEXT NOT NULL,               -- verbatim (JSON array stringified as published)
  source TEXT NOT NULL               -- 'data/hts/ch61.json; <edition>'
);
CREATE INDEX hts_code ON hts_lines(code) WHERE code <> '';

CREATE TABLE rulings (
  number TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL,
  hts_codes TEXT NOT NULL,           -- space-separated normalized codes
  text TEXT NOT NULL, url TEXT NOT NULL, source TEXT NOT NULL
);
CREATE TABLE ruling_codes (
  number TEXT NOT NULL REFERENCES rulings(number),
  code TEXT NOT NULL, heading TEXT NOT NULL,
  PRIMARY KEY (number, code)
);
CREATE INDEX ruling_heading ON ruling_codes(heading);

CREATE VIRTUAL TABLE hts_fts USING fts5(
  description, content='', tokenize='porter unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE rulings_fts USING fts5(
  title, text, content='', tokenize='porter unicode61 remove_diacritics 2');
```
FTS rowids equal `hts_lines.seq` and the ruling's `rowid`. Contentless tables (`content=''`) save space, and snippets come from a join to the base table with `snippet()` unavailable, so the module builds snippets from `rulings.text` in TypeScript around the first matched token. If that is awkward in task 9, switch to external-content tables (`content='rulings'`) and use `snippet()`.

## Public API (`src/query/index.ts`)
```ts
type TariffProv = { kind: 'tariff'; source: string; hts: string; edition: string };

type HtsLookup =
  | { status: 'ok'; code: string; description: string; general: string; special: string;
      other: string; units: string; indent: number; ancestors: string[]; prov: TariffProv }
  | { status: 'not_found' | 'invalid_code' | 'out_of_scope'; code: string };

lookupHts(db, code: string): HtsLookup
searchRulings(db, q: string, opts?: { limit?: number; heading?: string; chapter?: string }): RulingHit[]
searchHts(db, q: string, opts?: { limit?: number }): HtsHit[]
toFtsExpression(q: string, mode: 'and' | 'or'): string | null
```
`TariffProv` matches the `tariff` provenance in duty-calculator R7.3. The `edition` field is read from `meta`.

## Scripts and root wiring
- `packages/tariff-data/package.json`: `"data:fetch": "bun src/fetch/run.ts"`, `"data:build": "bun src/build/run.ts"`, `"test": "bun test"`.
- Root `package.json`: `"test": "vitest run && bun run --filter @notice-exorcist/tariff-data test"`. The second command is used rather than a workspace-wide `bun test`, which would also run Vitest files under bun's runner.
- Bun's runner picks up `*.test.ts`, as does Vitest. To keep them apart, tariff-data tests use `*.bun.test.ts`, the Vitest config excludes `packages/tariff-data/**`, and the package script runs `bun test --test-name-pattern` free: `bun test ./src ./test` with only `.bun.test.ts` files present there.
- `bun run test` pretest: the integration tests build the index themselves into `os.tmpdir()`, so no separate build step is needed.
- `.gitignore`: `packages/tariff-data/.cache/`.
- CI note: the same command runs in CI with Bun installed.

## Error handling
- Fetch: validate then rename. Per-chapter failure aborts with a non-zero exit and no partial overwrite. Per-ruling failures are collected and reported at the end.
- Build: Zod errors name the file and path. The index is written to `*.tmp` then renamed.
- Query: returns status values (`not_found`, `invalid_code`, `out_of_scope`), not exceptions. Index missing throws a typed `IndexNotBuiltError` that says to run `bun run data:build`.

## Testing
- Unit (`src/**/*.bun.test.ts`): `normalizeHts`, `toFtsExpression` (quotes, operators, empty), ruling code extraction, SOURCES.md regeneration, Zod rejection of malformed rows.
- Integration (`test/*.bun.test.ts`): build from the committed snapshot into a temp path, then check R5 to R8, including the `cotton t-shirt knitted` case and byte-for-byte `general` comparison against raw JSON.
- Fixtures for unit tests are verbatim excerpts of real rows, marked in a comment with the source file.
- Network is never used in tests. A fetch test uses an injected `fetch` function with a recorded response excerpt.

## Risks
- **Endpoint drift.** The USITC and CROSS endpoints are not formally versioned. Task 1 confirms them. The fetch script's Zod checks fail loudly on a shape change.
- **Search quality.** A bm25 search with a small ruling set may not rank 6109 rulings first for every query. The 6109 requirement is tested for one named query with the shipped selection. Broader accuracy is measured elsewhere (README "Measured accuracy").
- **CROSS rate limits and terms.** The script throttles and identifies itself. If the site blocks automated access, fall back to a manual export dropped into `data/rulings/` and keep the build unchanged.
- **Stale data.** The edition is stored and shown with every lookup through provenance, so a user can see which edition produced a rate.
