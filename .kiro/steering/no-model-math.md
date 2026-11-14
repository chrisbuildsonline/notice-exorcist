---
inclusion: always
---

# No model math

The model may extract text and explain jargon. It must never compute, convert, or round a figure.

## Rules
- Every displayed number needs a provenance record. Allowed sources:
  - `stated`: read from the notice. Never relabel it as computed.
  - `computed`: returned by `packages/duty-engine`, with formula, inputs, and rounding rule.
  - `tariff`: taken from tariff data (HTS rate, chapter 99 line) with its source and edition.
- A number with no provenance must not render. Fail the build or the test, not silently.
- Do not ask the model for totals, sums, percentages, currency conversions, or "approximately" values.
- Model prose may mention a figure only by quoting a value that already has provenance. Check this in code.
- Stated and computed values are shown side by side. A mismatch is a flag, never an overwrite.
- All arithmetic uses decimal.js in the duty engine. No float math on money anywhere else.

## Tests
- Property tests (fast-check) cover the engine: non-negativity, line sums equal totals, rounding is applied once.
- A UI or API test asserts that figures without provenance are rejected.
