import { join } from 'node:path';

export const SCOPE_CHAPTERS = ['39', '42', '61', '62', '63', '64', '71', '85', '94', '95'] as const;

export const PKG_DIR = join(import.meta.dir, '..');
export const DATA_DIR = join(PKG_DIR, 'data');
export const INDEX_PATH = process.env.TARIFF_INDEX_PATH ?? join(PKG_DIR, '.cache', 'tariff.sqlite');

export const HTS_BASE = 'https://hts.usitc.gov/reststop';
export const CROSS_BASE = 'https://rulings.cbp.gov';
export const USER_AGENT = 'notice-exorcist-tariff-data/0.1 (open-source tariff data snapshot)';

/** Rulings kept per four-digit heading, and the gap between CROSS requests. */
export const RULINGS_PER_HEADING = 10;
export const REQUEST_GAP_MS = 1000;
