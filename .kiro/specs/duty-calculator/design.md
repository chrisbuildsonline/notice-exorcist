# Design: duty-calculator

## Layout
```
packages/duty-engine/
  src/
    decimal.ts        Decimal config (precision 40, ROUND_HALF_UP) and money helpers
    provenance.ts     Provenance types, Zod schemas, MissingProvenanceError
    rate-text.ts      parseRateText(raw) -> ParsedRate
    line-duty.ts      computeLineDuty(input) -> DutyResult
    fees.ts           computeMpf, computeHmf
    fee-table.ts      loadFeeTable(json) -> FeeTable (Zod validated)
    compare.ts        compareFigures(stated, computed) -> Comparison
    index.ts          public API
  data/
    fees.json         Sourced fee table
  src/**/*.test.ts    Vitest, beside the code
  src/**/*.prop.test.ts   fast-check
```
No imports from outside the package except `decimal.js` and `zod` (already in the stack).

## Types
```ts
type Prov =
  | { kind: 'stated'; source: string }                       // notice page + box
  | { kind: 'tariff'; source: string; hts: string; edition: string }
  | { kind: 'computed'; formulaId: string; inputs: Record<string, Fig>; rounding: 'half-up-cents-once' | 'none' };

type Fig = { value: Decimal; prov: Prov };

type ParsedRate =
  | { kind: 'free'; raw: string }
  | { kind: 'ad_valorem'; percent: Decimal; raw: string }
  | { kind: 'specific'; amount: Decimal; unit: 'cents' | 'dollars'; per: string; raw: string }
  | { kind: 'compound'; parts: [Specific, AdValorem]; raw: string }
  | { kind: 'unsupported'; raw: string };

type DutyResult =
  | { status: 'ok'; duty: Fig; unrounded: Decimal; formulaId: string }
  | { status: 'unsupported'; raw: string; reason?: string };
```

## Decisions
- **Decimal config.** A local `Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })` is used so engine behaviour does not depend on global settings.
- **Rounding once.** Intermediate values stay unrounded. `roundCents()` is called only at the end of `computeLineDuty`, `computeMpf` and `computeHmf`. Totals sum already-rounded line figures, which matches how a notice lists them, and add no rounding step.
- **Parser.** A small anchored-regex parser, not a general grammar. Each supported form has one regex. Any input not fully matched returns `unsupported` with `raw` untouched. Cents (`¢`, `c`) and dollars (`$`) are the only specific-rate currencies.
- **Unsupported is a value, not an error.** Callers must handle it. The type has no numeric field, so the type system prevents using it as a number.
- **Fee table.** `fees.json` holds MPF (rate, min, max) and HMF (rate) per effective period, each with `sourceName`, `sourceUrl`, `effectiveFrom`, `effectiveTo`, `retrievedOn`. Values are copied from CBP's published fee notices and checked by a human before commit. The code holds no fee constants.
- **Provenance.** Every constructor of `Fig` requires `prov`. `computeLineDuty` copies input provenance into `computed.inputs`, so the calculation drawer can show each input's source.
- **Compare.** `compareFigures` never mutates the stated figure. It returns both and a difference figure labelled `computed`.
- **Exports.** The package exports parse, compute and compare functions plus types. `tariff-mcp` wraps them as `calculate_duty` without adding math.

## Error handling
- Invalid inputs (non-Decimal money, negative value, missing provenance): throw typed errors (`InvalidMoneyError`, `MissingProvenanceError`).
- Unsupported rate, unit mismatch, no fee table for date: return a result with `status: 'unsupported'`.

## Testing
- Vitest example tests for each rate form and fee case.
- fast-check property tests for the invariants in R9.
- Fixture rate strings taken from real HTS entries, including odd ones that must come back `unsupported`.
