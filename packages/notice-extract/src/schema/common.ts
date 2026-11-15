import { z } from 'zod';

/**
 * Value formats, copied from scripts/specimens/schema.ts (packages do not import scripts).
 * schema-parity.test.ts fails if they drift apart.
 */
export const Money = z.string().regex(/^-?\d+\.\d{2}$/);
export const Dec = z.string().regex(/^-?\d+(\.\d+)?$/);
export const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const HtsCode = z.string().regex(/^\d{4}\.\d{2}\.\d{2}(\.\d{2})?$/);

export const NOTICE_KINDS = ['cbp_form_28', 'cbp_form_29', 'courier_duty_invoice'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const ACTION_TYPES = ['rate_advance'] as const;
export const FEE_KINDS = ['mpf', 'hmf', 'courier_fee'] as const;
