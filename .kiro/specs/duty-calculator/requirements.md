# Requirements: duty-calculator

Package: `packages/duty-engine`. Pure and deterministic. No network, filesystem or model access. All arithmetic uses decimal.js. This is the only place duty math lives (`structure.md`, `no-model-math.md`).

## Terms
- **Rate text**: the HTS "General" column string, e.g. `Free`, `6.5%`, `2.4¢/kg`, `2.4¢/kg + 5%`.
- **Provenance record**: `{ kind: 'computed' | 'tariff' | 'stated', source, formulaId?, inputs, rounding? }` attached to a figure.
- **Fee table**: a versioned data file of MPF and HMF parameters, each with source URL, document name and effective date.

## Requirements

### R1. Decimal arithmetic
**User story:** As an importer, I want figures that never drift by float error.
1. THE engine SHALL represent every money amount, rate and quantity as a decimal.js `Decimal`.
2. THE engine SHALL NOT use JS `number` arithmetic on money or rates.
3. WHEN a function receives a `number` for money, THE engine SHALL reject it with a typed error. Inputs are `Decimal` or decimal strings.

### R2. Parse HTS rate text
1. WHEN rate text is `Free` (case-insensitive, trimmed), THE parser SHALL return `{ kind: 'free', raw }`.
2. WHEN rate text is a percentage such as `6.5%`, THE parser SHALL return `{ kind: 'ad_valorem', percent: Decimal('6.5'), raw }`.
3. WHEN rate text is a specific rate such as `2.4¢/kg` or `$1.20/doz`, THE parser SHALL return `{ kind: 'specific', amount, currencyUnit, per, raw }` with `amount` in a named unit (cents or dollars) and `per` a unit string.
4. WHEN rate text is a compound rate such as `2.4¢/kg + 5%`, THE parser SHALL return `{ kind: 'compound', parts: [specific, ad_valorem], raw }`.
5. WHEN rate text matches none of the supported forms (for example `See 9903.88.03`, `The rate applicable to the...`, `3.4% + 0.5¢/kg, max 8%`, or empty), THE parser SHALL return `{ kind: 'unsupported', raw }` where `raw` is the input unchanged.
6. THE parser SHALL NOT guess, round, normalize or partially parse unsupported text.
7. FOR ALL supported results, `raw` SHALL equal the input string exactly.

### R3. Line duty
1. WHEN the rate is `free`, THE engine SHALL return duty `0.00`.
2. WHEN the rate is `ad_valorem`, THE engine SHALL compute `entered value × percent / 100`.
3. WHEN the rate is `specific`, THE engine SHALL compute `quantity × amount` and require the quantity unit to equal `per`. IF the units differ, THEN THE engine SHALL return `{ status: 'unsupported', reason: 'unit_mismatch' }`.
4. WHEN the rate is `compound`, THE engine SHALL compute the sum of its parts before rounding.
5. WHEN the rate is `unsupported`, THE engine SHALL return `{ status: 'unsupported', raw }` and SHALL NOT return a number.
6. THE engine SHALL round half-up to cents exactly once, on the final line duty.
7. THE engine SHALL return the formula id, inputs and the unrounded value in the result.

### R4. Merchandise Processing Fee (MPF)
1. THE engine SHALL read the MPF rate, minimum and maximum from the fee table, never from constants in code.
2. THE engine SHALL compute `entered value × MPF rate`, clamp it to `[minimum, maximum]`, then round half-up to cents once.
3. WHERE the fee table has no entry covering the entry date, THE engine SHALL return `{ status: 'unsupported', reason: 'no_fee_table_for_date' }`.
4. WHERE the entry is exempt by an input flag from the notice (for example a stated exemption), THE engine SHALL NOT infer the exemption itself. It SHALL compute only when the caller says the fee applies.

### R5. Harbor Maintenance Fee (HMF)
1. THE engine SHALL read the HMF rate from the fee table.
2. WHEN the caller marks the shipment as ocean and the fee applies, THE engine SHALL compute `entered value × HMF rate`, rounded half-up to cents once.
3. WHEN the shipment is not marked ocean, THE engine SHALL return `{ status: 'not_applicable' }` and no amount.

### R6. Sourced fee table
1. EACH fee table entry SHALL carry `rate`, optional `minimum` and `maximum`, `effectiveFrom`, `effectiveTo`, `sourceName`, `sourceUrl` and `retrievedOn`.
2. WHEN the table is loaded, THE loader SHALL validate it with Zod and reject entries missing any source field.
3. THE loader SHALL reject overlapping effective date ranges for the same fee.

### R7. Provenance on every output
1. EVERY figure returned by the engine SHALL carry a provenance record.
2. A computed figure SHALL record `kind: 'computed'`, the formula id, the inputs (each with its own provenance), and the rounding rule.
3. A rate taken from tariff data SHALL record `kind: 'tariff'` with HTS code, edition and revision.
4. THE engine SHALL pass through `stated` inputs with their provenance unchanged and SHALL NOT relabel them as computed.
5. IF an input lacks provenance, THEN THE engine SHALL throw a typed `MissingProvenanceError`.

### R8. Comparison with the notice
1. WHEN a stated figure and a computed figure differ, THE engine SHALL return `{ state: 'disagrees', stated, computed, difference }` with all three carrying provenance, and SHALL NOT overwrite the stated figure.
2. WHEN they are equal to the cent, THE engine SHALL return `{ state: 'verified' }`.
3. WHEN the computed side is unsupported, THE engine SHALL return `{ state: 'unsupported' }`.
4. THE difference SHALL be computed by the engine as `|stated − computed|` and labelled `computed`.

### R9. Invariants (property tests, fast-check)
1. Non-negativity: FOR ALL non-negative inputs, every duty and fee SHALL be ≥ 0.
2. Sum: the notice total SHALL equal the sum of its line duties and fees, with no extra rounding step.
3. Single rounding: rounding SHALL be applied once. Re-rounding a result SHALL not change it.
4. Parser round trip: FOR ALL supported rate text, `raw` SHALL equal the input.
5. Unsupported safety: FOR ALL strings not matching a supported form, the parser SHALL return `unsupported` with the same `raw`.
6. MPF bounds: FOR ALL values, MPF SHALL be within `[minimum, maximum]`.
7. Monotonicity: FOR ad valorem rates, a higher value SHALL NOT give a lower duty.
8. Provenance: FOR ALL outputs, a provenance record SHALL exist.
