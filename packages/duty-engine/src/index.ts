import feesJson from '../data/fees.json';
import { loadFeeTable } from './fee-table';

export { D, InvalidMoneyError, roundCents, toMoney, type Decimal } from './decimal';
export {
  assertFig,
  assertProv,
  makeFig,
  MissingProvenanceError,
  PROVENANCE_KINDS,
  type ComputedProv,
  type FeeTableRef,
  type Fig,
  type Prov,
  type ProvenanceKind,
  type Rounding,
  type StatedProv,
  type TariffProv,
} from './provenance';
export { parseRateText, type AdValorem, type Compound, type Free, type ParsedRate, type Specific, type Unsupported } from './rate-text';
export { computeLineDuty, type DutyResult, type LineInput } from './line-duty';
export { loadFeeTable, type FeeEntry, type FeeKind, type FeeTable } from './fee-table';
export { computeHmf, computeMpf, type FeeInput, type FeeResult } from './fees';
export { compareFigures, computeTotal, type Comparison, type TotalResult } from './compare';

/** The sourced fee table shipped in data/fees.json, validated when the module loads. */
export const FEE_TABLE = loadFeeTable(feesJson);
