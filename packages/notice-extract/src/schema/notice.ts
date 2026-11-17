import { z } from 'zod';
import { courierInvoiceSchema } from './courier';
import { type LeafFn, ModelStated, Stated } from './field';
import { form28Schema } from './form28';
import { form29Schema } from './form29';

const noticeSchema = (L: LeafFn) =>
  z.discriminatedUnion('kind', [form28Schema(L), form29Schema(L), courierInvoiceSchema(L)]);

/** A validated notice: every leaf a stated field with provenance written by this package. */
export const Notice = noticeSchema(Stated);
export type Notice = z.infer<typeof Notice>;

/**
 * The same notice as the model writes it: leaves without `prov` or `needs_confirmation`.
 * Used only to validate the raw response; its parsed output is never used, so its type is opaque.
 */
export const ModelNotice: z.ZodType<unknown> = noticeSchema(ModelStated as unknown as LeafFn);
