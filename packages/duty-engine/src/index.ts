/** Where a figure came from. A figure with none of these is never shown. */
export const PROVENANCE_KINDS = ['stated', 'computed', 'tariff'] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];
