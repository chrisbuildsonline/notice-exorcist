import { D, roundCents, type Decimal } from './decimal';
import type { FeeEntry, FeeKind, FeeTable } from './fee-table';
import { assertFig, type Fig, type TariffProv } from './provenance';

export type FeeResult =
  | { status: 'ok'; fee: Fig; unrounded: Decimal; formulaId: string }
  | { status: 'unsupported'; reason: 'no_fee_table_for_date' }
  | { status: 'not_applicable' };

export type FeeInput = {
  enteredValue: Fig;
  /** ISO date (YYYY-MM-DD) of the entry; picks the fiscal-year row of the fee table. */
  entryDate: string;
  table: FeeTable;
  /** The caller's statement that the fee applies (for example from the notice). The engine never infers an exemption. */
  applies: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function findEntry(table: FeeTable, fee: FeeKind, date: string): FeeEntry | undefined {
  if (!ISO_DATE.test(date)) throw new RangeError(`entryDate: expected YYYY-MM-DD, got ${JSON.stringify(date)}`);
  return table.entries.find((e) => e.fee === fee && e.effectiveFrom <= date && date <= e.effectiveTo);
}

function tableProv(e: FeeEntry): TariffProv {
  const { fee, sourceName, effectiveFrom, effectiveTo, retrievedOn } = e;
  return { kind: 'tariff', source: e.sourceUrl, feeTable: { fee, sourceName, effectiveFrom, effectiveTo, retrievedOn } };
}

function result(formulaId: string, unrounded: Decimal, inputs: Record<string, Fig>): FeeResult {
  return {
    status: 'ok',
    fee: { value: roundCents(unrounded), prov: { kind: 'computed', formulaId, inputs, rounding: 'half-up-cents-once' } },
    unrounded,
    formulaId,
  };
}

/** Merchandise Processing Fee: entered value x rate, clamped to [minimum, maximum], rounded half-up to cents once. */
export function computeMpf(input: FeeInput): FeeResult {
  const enteredValue = assertFig(input.enteredValue, 'enteredValue');
  const entry = findEntry(input.table, 'mpf', input.entryDate);
  if (!input.applies) return { status: 'not_applicable' };
  if (!entry) return { status: 'unsupported', reason: 'no_fee_table_for_date' };
  const prov = tableProv(entry);
  const ratePercent = { value: new D(entry.rate), prov };
  const minimum = { value: new D(entry.minimum!), prov };
  const maximum = { value: new D(entry.maximum!), prov };
  const raw = new D(enteredValue.value).times(ratePercent.value).div(100);
  const clamped = D.min(D.max(raw, minimum.value), maximum.value);
  return result('fee.mpf', clamped, { enteredValue, ratePercent, minimum, maximum });
}

/** Harbor Maintenance Fee: entered value x rate for ocean shipments, rounded half-up to cents once. */
export function computeHmf(input: FeeInput & { ocean: boolean }): FeeResult {
  const enteredValue = assertFig(input.enteredValue, 'enteredValue');
  const entry = findEntry(input.table, 'hmf', input.entryDate);
  if (!input.ocean || !input.applies) return { status: 'not_applicable' };
  if (!entry) return { status: 'unsupported', reason: 'no_fee_table_for_date' };
  const ratePercent = { value: new D(entry.rate), prov: tableProv(entry) };
  return result('fee.hmf', new D(enteredValue.value).times(ratePercent.value).div(100), { enteredValue, ratePercent });
}
