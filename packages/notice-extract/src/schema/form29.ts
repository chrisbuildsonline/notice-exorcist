import { z } from 'zod';
import { datesSchema, feeSchema, headerShape, lineSchema, statedTotalSchema } from './base';
import { ACTION_TYPES } from './common';
import { type LeafFn, Stated } from './field';

/** CBP Form 29, Notice of Action: the action marked, lines with stated duty, fees and printed totals. */
export const form29Schema = (L: LeafFn) =>
  z
    .object({
      kind: z.literal('cbp_form_29'),
      ...headerShape(L),
      actionType: L(z.enum(ACTION_TYPES)),
      dates: datesSchema(L, { deadlineNullable: true }),
      courier: z.null(),
      informationRequested: z.array(L(z.string())).max(0),
      lines: z.array(lineSchema(L, { dutyNullable: false })).min(1),
      fees: z.array(feeSchema(L)),
      statedTotals: z.array(statedTotalSchema(L)),
    })
    .strict();

export const Form29 = form29Schema(Stated);
