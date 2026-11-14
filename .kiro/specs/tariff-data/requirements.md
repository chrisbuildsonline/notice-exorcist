# Requirements: tariff-data

Package: `packages/tariff-data`. A fetch script downloads official tariff and ruling data into `data/`. A build script turns that data into a SQLite FTS5 index with `bun:sqlite`. A small query module serves lookups and search. `tariff-mcp` will wrap the query module later (`structure.md`). The query module does no math (`no-model-math.md`).

## Terms
- **HTS line**: one row of the USITC Harmonized Tariff Schedule export, including heading rows without a code.
- **Rate text**: the HTS "General" column string, stored and returned exactly as published (same meaning as in duty-calculator).
- **Edition**: the HTS edition and revision the download came from, e.g. `2026 Revision 7`.
- **Ruling**: a CBP CROSS published ruling (for example `N312345`).
- **Scope chapters**: 39, 42, 61, 62, 63, 64, 71, 85, 94, 95.
- **Index**: the SQLite file built from `data/`. It is a build artifact and is not committed.
- **Snapshot**: the committed files under `data/` (raw downloads plus `SOURCES.md`).

## Requirements

### R1. Download HTS data
**User story:** As a maintainer, I want the official tariff text for the scope chapters, so that rates come from the source.
1. WHEN the maintainer runs `bun run data:fetch`, THE fetch script SHALL download the USITC HTS JSON export for each scope chapter and no other chapter.
2. THE fetch script SHALL write one raw JSON file per chapter to `data/hts/`, byte for byte as received.
3. THE fetch script SHALL record the edition, the request URL and the retrieval timestamp for each file in `data/manifest.json`.
4. IF a download fails or returns invalid JSON or an empty list, THEN THE script SHALL exit non-zero, name the chapter, and leave previously stored files unchanged.
5. THE script SHALL write each file to a temporary path and rename it only after validation passes.

### R2. Download CROSS rulings
**User story:** As a maintainer, I want published rulings for the scope headings, so that candidate codes come with citations.
1. WHEN the maintainer runs `bun run data:fetch`, THE script SHALL download CBP CROSS rulings whose classification falls in a scope chapter, up to a configured maximum per four-digit heading.
2. THE script SHALL write one raw JSON file per ruling to `data/rulings/`, named by ruling number.
3. THE script SHALL record the source URL and retrieval timestamp of each ruling in `data/manifest.json`.
4. THE script SHALL throttle requests to a configured rate and send an identifying `User-Agent`.
5. IF a single ruling fails to download, THEN THE script SHALL log its number, continue, and exit non-zero at the end with the list of failures.
6. THE script SHALL skip rulings already present in the snapshot unless `--refresh` is passed.
7. THE default selection SHALL include at least five rulings for heading 6109.

### R3. Sources and licence note
1. THE snapshot SHALL include `data/SOURCES.md` naming each source (USITC HTS, CBP CROSS), its URL, the edition, and the retrieval date.
2. THE note SHALL state that both sources are works of the US government and in the public domain, and SHALL say the repository's MIT licence does not apply to the data.
3. THE note SHALL state that the data may be out of date and is not legal advice.
4. WHEN the fetch script finishes successfully, THE script SHALL regenerate the edition and date lines in `SOURCES.md` from `manifest.json`.
5. IF `data/SOURCES.md` is missing, THEN THE build script SHALL fail.

### R4. Build the index
**User story:** As a developer, I want one local database for lookups and search.
1. WHEN the maintainer runs `bun run data:build`, THE build script SHALL create the index at the path in `TARIFF_INDEX_PATH`, defaulting to `packages/tariff-data/.cache/tariff.sqlite`.
2. THE build script SHALL use `bun:sqlite` and no other SQLite dependency.
3. THE index SHALL contain table `hts_lines` with columns `seq`, `chapter`, `code`, `indent`, `description`, `general`, `special`, `other`, `units`, `source`.
4. THE index SHALL contain table `rulings` with columns `number`, `date`, `title`, `hts_codes`, `text`, `url`, `source`.
5. THE index SHALL contain a table `meta` with the edition, the build time, and row counts.
6. THE index SHALL contain FTS5 tables over `hts_lines.description` and over `rulings.title` and `rulings.text`.
7. THE build SHALL be deterministic: the same snapshot SHALL produce the same rows.
8. THE build script SHALL write to a temporary file and rename it on success. IF any input file fails validation, THEN THE script SHALL exit non-zero, name the file, and leave the previous index unchanged.
9. THE build script SHALL validate every input record with Zod. It SHALL NOT patch or default missing fields silently. Empty strings that the source publishes as empty SHALL be stored as empty strings.
10. THE build script SHALL normalize HTS codes to a dotted form (`6109.10.00`) in `code`, and SHALL store the text for `general`, `special`, `other` and `units` exactly as published, with no trimming, case change or rewriting.
11. THE `source` column SHALL name the file and edition (HTS) or the ruling URL (rulings).
12. THE build script SHALL store each ruling's HTS codes in `hts_codes` as one normalized code per entry, and in a child table `ruling_codes(number, code, heading)` for exact filtering.

### R5. Lookup by HTS code
**User story:** As a user, I want the official general rate text for a code.
1. WHEN `lookupHts(code)` receives a code with or without dots (`6109100012`, `6109.10.00.12`, `6109.10.00`), THE module SHALL return the matching line's `general` text exactly as stored.
2. THE result SHALL include `description`, `special`, `other`, `units`, `indent`, the ancestor descriptions (nearest first by `indent` and `seq`), and a provenance record `{ kind: 'tariff', source, hts, edition }`.
3. THE module SHALL NOT parse, compute, round or reformat rate text. Interpreting rate text belongs to `duty-engine`.
4. IF a line has an empty `general` value because the rate is published on a child line, THEN THE module SHALL return the empty string and SHALL NOT inherit a rate from another line.
5. WHEN the code does not exist in the index, THE module SHALL return `{ status: 'not_found', code }`.
6. WHEN the code is malformed, THE module SHALL return `{ status: 'invalid_code', code }` and SHALL NOT query with it.
7. WHEN a code belongs to a chapter outside the scope, THE module SHALL return `{ status: 'out_of_scope', code }`, not `not_found`.
8. THE module SHALL use parameterized queries only.

### R6. Full-text search
**User story:** As a user, I want candidate codes and rulings from a product description.
1. WHEN `searchRulings(query, { limit })` receives a free-text query, THE module SHALL return rulings ranked by FTS5 `bm25`, each with `number`, `date`, `title`, `htsCodes`, `url` and a snippet.
2. THE module SHALL turn the query into a safe FTS5 expression: tokens split on non-alphanumerics, each token quoted, joined with AND. IF that returns no rows, THEN THE module SHALL retry with OR.
3. THE module SHALL NOT pass raw user text as FTS5 syntax. A query containing `"`, `*`, `NEAR`, `-` or `:` SHALL NOT raise a syntax error.
4. WHEN the query is `cotton t-shirt knitted`, THE module SHALL return at least one ruling classified under heading 6109 among the top five results.
5. WHERE the caller passes a `heading` or `chapter` filter, THE module SHALL restrict results to rulings with a matching row in `ruling_codes`.
6. WHEN `searchHts(query, { limit })` is called, THE module SHALL return matching `hts_lines` with the same safe expression rules.
7. WHEN the query is empty or has no alphanumeric token, THE module SHALL return an empty list.
8. THE search result SHALL NOT carry a classification verdict. Results are candidates with citations (`product.md`).

### R7. Integration tests on the built index
1. THE package SHALL have integration tests that build the index from the committed snapshot into a temporary path and run queries against it.
2. THE tests SHALL run under `bun test`, because `bun:sqlite` needs the Bun runtime.
3. THE root `bun run test` script SHALL run Vitest and the `bun test` suite for `packages/tariff-data`, and SHALL fail if either fails.
4. Vitest SHALL NOT pick up the `bun test` files.
5. THE tests SHALL NOT use the network.
6. THE tests SHALL assert at least: lookup of `6109.10.00` returns the general text from the snapshot byte for byte; lookup of a malformed code returns `invalid_code`; the `cotton t-shirt knitted` case in R6.4; a query with FTS5 syntax characters does not throw; an out-of-scope code returns `out_of_scope`.
7. THE tests SHALL include a data check that every scope chapter has at least one `hts_lines` row and that no row belongs to another chapter.

### R8. Data integrity
1. A test SHALL compare every `general` value in the index with the raw JSON in `data/hts/` and fail on any difference.
2. A test SHALL check that every line's `source` is non-empty and that `meta.edition` equals the edition in `manifest.json`.
3. A test SHALL check that every ruling has a non-empty `url` starting with `https://rulings.cbp.gov/`.
4. THE package SHALL NOT log notice contents. The scripts handle only public tariff data.

### R9. Dependencies and boundaries
1. THE package SHALL use Bun built-ins (`fetch`, `bun:sqlite`, `bun test`) and `zod`, which is already in the stack.
2. THE package SHALL NOT import from `apps/web` or from `duty-engine`.
3. THE fetch script SHALL be the only code in the package that uses the network. Query code SHALL have no network access.
4. THE package SHALL NOT make up rates, descriptions or ruling text. A test fixture SHALL be a verbatim excerpt of real data, labelled as such.
