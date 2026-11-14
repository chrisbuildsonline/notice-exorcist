# Tasks: duty-calculator

Run `bun run test` and `bun run typecheck` after each task. Each task names the test that proves it.

- [x] 1. Scaffold `packages/duty-engine` (Bun workspace member, strict TS, Vitest, fast-check, decimal.js, zod). Add `decimal.ts` with a cloned Decimal config and `roundCents`.
  - Test: `decimal.test.ts` checks `0.1 + 0.2 = 0.3`, half-up at `.005`, and that `roundCents` is idempotent. Covers R1.1, R1.2.
- [x] 2. Reject non-Decimal money input with `InvalidMoneyError`.
  - Test: `money-input.test.ts` passes a JS `number` and expects the typed error. Covers R1.3.
- [x] 3. Add `provenance.ts` (types, Zod schemas, `MissingProvenanceError`, `makeFig`).
  - Test: `provenance.test.ts` expects a throw when `prov` is missing and a pass-through of `stated` provenance unchanged. Covers R7.4, R7.5.
- [x] 4. Implement `parseRateText` for `Free` and ad valorem.
  - Test: `rate-text.test.ts` cases `Free`, `free `, `6.5%`, `0%`, `12%`, each asserting `raw` equals input. Covers R2.1, R2.2, R2.7.
- [x] 5. Extend the parser to specific and compound rates.
  - Test: `rate-text.test.ts` cases `2.4¢/kg`, `$1.20/doz`, `2.4¢/kg + 5%`. Covers R2.3, R2.4.
- [x] 6. Make everything else return `unsupported` with the raw text.
  - Test: `rate-text-unsupported.test.ts` cases `See 9903.88.03`, empty string, `3.4% + 0.5¢/kg, max 8%`, `Free except as provided`, and checks no field other than `kind` and `raw`. Covers R2.5, R2.6.
- [x] 7. Property test for the parser.
  - Test: `rate-text.prop.test.ts` (a) generated supported strings keep `raw`, (b) generated strings outside the grammar return `unsupported` with identical `raw`. Covers R9.4, R9.5.
- [x] 8. Implement `computeLineDuty` for `free` and `ad_valorem` with single half-up rounding and provenance.
  - Test: `line-duty.test.ts` with `$996.92 × 6.5% = 64.80` (unrounded 64.7998), the formula id and inputs in `prov`. Covers R3.1, R3.2, R3.6, R3.7, R7.1, R7.2.
- [x] 9. Add specific and compound duty and unit mismatch handling.
  - Test: `line-duty-specific.test.ts` for `kg` quantity, compound sum before rounding, and `unit_mismatch` result. Covers R3.3, R3.4.
- [x] 10. Return `unsupported` for unsupported rates with no numeric field.
  - Test: `line-duty-unsupported.test.ts` asserts `status: 'unsupported'`, `raw` preserved, and a type test (`expectTypeOf`) that no `duty` field exists. Covers R3.5.
- [ ] 11. Add `fee-table.ts` loader and `data/fees.json` with source fields for every entry. A human checks the values against CBP's notice before commit.
  - Test: `fee-table.test.ts` rejects entries missing a source field and overlapping date ranges, and accepts the shipped `fees.json`. Covers R6.1, R6.2, R6.3.
- [ ] 12. Implement `computeMpf` with min/max clamp from the table.
  - Test: `mpf.test.ts` for below-minimum, within range, above-maximum, date with no table, and no inferred exemption. Covers R4.1 to R4.4.
- [ ] 13. Implement `computeHmf`.
  - Test: `hmf.test.ts` for ocean, non-ocean (`not_applicable`), and rounding once. Covers R5.1 to R5.3.
- [ ] 14. Implement `compareFigures` and the notice total check.
  - Test: `compare.test.ts` for equal, differing, unsupported, and that the stated figure object is unchanged (deep equal before and after). Covers R8.1 to R8.4.
- [ ] 15. Property tests for engine invariants.
  - Test: `engine.prop.test.ts` covers non-negativity, line sums equal total, single rounding, MPF bounds, ad valorem monotonicity, and provenance present on all outputs. Covers R9.1 to R9.3, R9.6 to R9.8.
- [ ] 16. Export the public API from `index.ts` and add a boundary check that the package imports nothing but `decimal.js` and `zod`.
  - Test: `boundary.test.ts` scans package sources for imports of `node:fs`, `node:net`, `fetch`, or other workspace packages and fails if found. Covers the no-I/O rule in `structure.md`.
