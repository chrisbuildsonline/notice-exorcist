import { z } from 'zod';

/** One row of the USITC HTS JSON export. Only the fields the index stores are checked. */
export const HtsExportRow = z.object({
  htsno: z.string(),
  indent: z.string().regex(/^\d+$/),
  description: z.string(),
  units: z.array(z.string()),
  general: z.string(),
  special: z.string(),
  other: z.string(),
});
export type HtsExportRow = z.infer<typeof HtsExportRow>;
export const HtsExport = z.array(HtsExportRow).min(1);

/** One CBP CROSS ruling as returned by /api/ruling/<number>. */
export const CrossRuling = z.object({
  rulingNumber: z.string().regex(/^[A-Z]{1,2}\d{5,6}$/),
  rulingDate: z.string(),
  subject: z.string(),
  tariffs: z.string().nullable(),
  text: z.string().min(1),
  collection: z.string(),
});
export type CrossRuling = z.infer<typeof CrossRuling>;

const FileEntry = z.object({
  url: z.url(),
  retrievedAt: z.iso.datetime(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

/** data/manifest.json: the HTS edition plus one entry per raw file, keyed by its path under data/. */
export const Manifest = z.object({
  edition: z.string().min(1),
  files: z.record(z.string(), FileEntry),
});
export type Manifest = z.infer<typeof Manifest>;
