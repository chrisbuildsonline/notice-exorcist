import { z } from 'zod';
import { datesSchema, feeSchema, headerShape, lineSchema, statedTotalSchema } from './base';
import { type LeafFn, Stated } from './field';

/** CBP Form 28, Request for Information: what CBP asks for, by when, and the lines it asks about. */
export const form28Schema = (L: LeafFn) =>
  z
    .object({
      kind: z.literal('cbp_form_28'),
      ...headerShape(L),
      /** Only a Form 29 marks an action, so the value here is always null. */
      actionType: L(z.null(), { nullable: true }),
      dates: datesSchema(L, { deadlineNullable: false }),
      courier: z.null(),
      informationRequested: z.array(L(z.string())).min(1),
      /** A Form 28 prints no duty, so dutyStated may be blank. */
      lines: z.array(lineSchema(L, { dutyNullable: true })).min(1),
      fees: z.array(feeSchema(L)),
      statedTotals: z.array(statedTotalSchema(L)),
    })
    .strict();

export const Form28 = form28Schema(Stated);
