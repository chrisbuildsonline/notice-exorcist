import type { Specimen } from '../schema';
import { courierHtml } from './courier';
import { form28Html } from './form28';
import { form29Html } from './form29';

const BUILDERS = { cbp_form_28: form28Html, cbp_form_29: form29Html, courier_duty_invoice: courierHtml } as const;

/** The self-contained HTML for one specimen. Same input, same string. */
export const specimenHtml = (s: Specimen): string => BUILDERS[s.kind](s);
