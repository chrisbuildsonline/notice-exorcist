import type { FigureJson } from './assess';

/** A figure the draft quotes: a snapshot of a provenance record from duty-engine or the notice, by id. */
export type ProvRef = FigureJson & { id: string };

/** What a claim cites: an HTS line, a CROSS ruling or a box on the notice. */
export type Citation = { id: string; kind: 'hts' | 'ruling' | 'notice'; label: string; href?: string };

/**
 * The reply text. Each paragraph is plain text with tokens: `{{fig:<id>}}` draws the figure with that id,
 * `{{cite:<id>}}` a citation chip. No figure is ever written as digits.
 */
export type DraftContent = { paragraphs: string[]; figures: ProvRef[]; citations: Citation[] };
