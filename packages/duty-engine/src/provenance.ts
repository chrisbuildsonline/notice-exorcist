import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { toMoney } from './decimal';

/** Where a figure came from. A figure with none of these is never shown. */
export const PROVENANCE_KINDS = ['stated', 'computed', 'tariff'] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export type Rounding = 'half-up-cents-once' | 'none';

/** A row of the sourced fee table (data/fees.json) that a fee figure was taken from. */
export type FeeTableRef = {
  fee: string;
  sourceName: string;
  effectiveFrom: string;
  effectiveTo: string;
  retrievedOn: string;
};

export type StatedProv = { kind: 'stated'; source: string };
/** Reference data: an HTS line (code + edition) or a fee table row. `source` is the URL or document. */
export type TariffProv =
  | { kind: 'tariff'; source: string; hts: string; edition: string }
  | { kind: 'tariff'; source: string; feeTable: FeeTableRef };
export type ComputedProv = {
  kind: 'computed';
  formulaId: string;
  inputs: Record<string, Fig>;
  rounding: Rounding;
  /** The rate text the formula applied, verbatim, when a rate was involved. */
  rateText?: string;
};
export type Prov = StatedProv | TariffProv | ComputedProv;

export type Fig = { value: Decimal; prov: Prov };

/** Thrown when a figure or input arrives without a valid provenance record. */
export class MissingProvenanceError extends Error {
  override name = 'MissingProvenanceError';
  constructor(readonly field: string, detail: string) {
    super(`${field}: missing or invalid provenance (${detail})`);
  }
}

const nonEmpty = z.string().min(1);
const isoDate = z.iso.date();

const FigSchema: z.ZodType<Fig> = z.lazy(() =>
  z.object({ value: z.custom<Decimal>((v) => Decimal.isDecimal(v)), prov: ProvSchema }),
);

export const ProvSchema: z.ZodType<Prov> = z.union([
  z.object({ kind: z.literal('stated'), source: nonEmpty }),
  z.object({ kind: z.literal('tariff'), source: nonEmpty, hts: nonEmpty, edition: nonEmpty }),
  z.object({
    kind: z.literal('tariff'),
    source: nonEmpty,
    feeTable: z.object({
      fee: nonEmpty,
      sourceName: nonEmpty,
      effectiveFrom: isoDate,
      effectiveTo: isoDate,
      retrievedOn: isoDate,
    }),
  }),
  z.object({
    kind: z.literal('computed'),
    formulaId: nonEmpty,
    inputs: z.record(z.string(), z.lazy(() => FigSchema)),
    rounding: z.enum(['half-up-cents-once', 'none']),
    rateText: z.string().optional(),
  }),
]);

/** Throw unless `prov` is a valid provenance record. Returns it untouched. */
export function assertProv(prov: unknown, field: string): Prov {
  const r = ProvSchema.safeParse(prov);
  if (!r.success) throw new MissingProvenanceError(field, r.error.issues[0]?.message ?? 'invalid');
  return prov as Prov;
}

/** Build a figure. The value must be a Decimal or decimal string; the provenance is kept as the same object. */
export function makeFig(value: Decimal | string, prov: Prov, field = 'figure'): Fig {
  return { value: toMoney(value, field), prov: assertProv(prov, field) };
}

/** Check a figure handed to the engine and return it as is (stated provenance passes through unchanged). */
export function assertFig(fig: unknown, field: string): Fig {
  if (typeof fig !== 'object' || fig === null) throw new MissingProvenanceError(field, 'not a figure');
  const f = fig as { value?: unknown; prov?: unknown };
  toMoney(f.value, field);
  assertProv(f.prov, field);
  return fig as Fig;
}
