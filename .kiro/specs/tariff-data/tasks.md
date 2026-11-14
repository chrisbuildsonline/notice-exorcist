# Tasks: tariff-data

Run `bun run test` and `bun run typecheck` after each task. Each task names the test that proves it. Network is used only in tasks 1, 4 and 5, by a human running the fetch script.

- [ ] 1. Confirm the data endpoints by hand. Fetch one HTS chapter export and one CROSS ruling, note the real field names and the edition source, and update `design.md` if anything differs.
  - Check: a short note in `design.md` "Data sources" with the confirmed URLs and field names. Covers R1, R2 design assumptions.
- [x] 2. Scaffold `packages/tariff-data` (Bun workspace member, strict TS, `zod`). Add `config.ts` and `codes.ts` (`normalizeHts`, `chapterOf`, `headingOf`, `isInScope`). Add `.cache/` to `.gitignore`.
  - Test: `codes.bun.test.ts` for `6109100012`, `6109.10.00`, `6109`, 5-digit and non-digit input (invalid), chapters 39 and 99. Covers R5.1, R5.6, R5.7.
- [x] 3. Add Zod schemas for HTS rows, CROSS rulings and the manifest. Rejected input names the field.
  - Test: `schemas.bun.test.ts` accepts verbatim excerpts of real rows, rejects a row missing `general`, and keeps empty strings as empty strings. Covers R4.9.
- [ ] 4. Write the HTS fetch script (`fetch/hts.ts`, `fetch/run.ts`): scope chapters only, temp-then-rename, manifest entries with sha256.
  - Test: `fetch-hts.bun.test.ts` with an injected `fetch`: writes raw bytes unchanged, fails on invalid JSON and on an empty list without touching existing files, requests only scope chapters. Then run `bun run data:fetch` once and commit `data/hts/`. Covers R1.1 to R1.5.
- [ ] 5. Write the CROSS fetch script (`fetch/cross.ts`): search per scope heading, cap per heading, throttle, `User-Agent`, skip existing, `--refresh`, collect failures. Run it and commit `data/rulings/`.
  - Test: `fetch-cross.bun.test.ts` with an injected `fetch`: respects the cap, skips existing files, continues after one failure and exits non-zero. Check by listing `data/rulings/` that at least five rulings have a 6109 code. Covers R2.1 to R2.7.
- [ ] 6. Write `data/SOURCES.md` (sources, URLs, public-domain statement, MIT does not cover the data, not legal advice) and `fetch/sources-note.ts` to regenerate the edition and date lines from the manifest.
  - Test: `sources-note.bun.test.ts` regenerates lines without touching the rest, and the build fails when the file is missing. Covers R3.1 to R3.5.
- [ ] 7. Write `build/schema.sql` and the build script for `hts_lines`, `meta`, and `hts_fts`: Zod validation, normalization, verbatim text columns, temp-then-rename, deterministic order.
  - Test: `build-hts.bun.test.ts` builds to a temp path, checks row counts against raw files, builds twice and compares rows, and confirms a bad input file leaves the old index intact. Covers R4.1 to R4.3, R4.5 to R4.11.
- [ ] 8. Extend the build with `rulings`, `ruling_codes` and `rulings_fts`.
  - Test: `build-rulings.bun.test.ts` checks code extraction comes from the tariff field only, codes are normalized, `url` and `source` are set, and a ruling listing 6109.10.00 has a `ruling_codes` row with heading `6109`. Covers R4.4, R4.6, R4.11, R4.12.
- [ ] 9. Implement `toFtsExpression` and `searchRulings` / `searchHts` (bm25, AND then OR fallback, heading and chapter filters, snippets).
  - Test: `search.bun.test.ts` for quoting, inputs with `"`, `*`, `NEAR`, `-`, `:` (no throw), empty query (empty list), OR fallback, and filters. Covers R6.1 to R6.3, R6.5 to R6.8.
- [ ] 10. Implement `lookupHts` with ancestors, provenance, and the `not_found`, `invalid_code`, `out_of_scope` statuses. No rate inheritance, no parsing.
  - Test: `lookup.bun.test.ts` on the built index: `6109.10.00` returns the stored general text, a code with an empty general returns `''`, a heading-row code returns `not_found`, chapter 87 returns `out_of_scope`, `abc` returns `invalid_code`. Covers R5.1 to R5.8.
- [ ] 11. Integration tests on the built index in `test/`: the R7.6 list, including `cotton t-shirt knitted` with a 6109 ruling in the top five, and per-chapter coverage (R7.7).
  - Test: `test/index.integration.bun.test.ts`. Covers R6.4, R7.1, R7.5 to R7.7.
- [ ] 12. Data integrity tests: every `general` equals the raw JSON value, `source` non-empty, `meta.edition` equals the manifest edition, ruling URLs start with `https://rulings.cbp.gov/`.
  - Test: `test/integrity.bun.test.ts`. Covers R8.1 to R8.3.
- [ ] 13. Wire the root test script: Vitest then `bun test` for tariff-data. Exclude `packages/tariff-data/**` from Vitest.
  - Test: `bun run test` runs both suites. Break one tariff-data test on purpose and confirm the root command exits non-zero, then revert. Covers R7.2 to R7.4.
- [ ] 14. Add a boundary test: the package does not import `apps/web` or `duty-engine`, and only `src/fetch/` uses `fetch`.
  - Test: `boundary.bun.test.ts` scans sources. Covers R9.2, R9.3.
- [ ] 15. Update `structure.md` to list `packages/tariff-data`, and add the `data:fetch` and `data:build` commands to the README Develop section.
  - Check: files diff shows only those additions. Covers the layout note in `design.md`.
