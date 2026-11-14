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

/**
 * Rulings to download, by four-digit heading. CROSS search needs a reCAPTCHA token, so the numbers are
 * listed here; `data:fetch` checks each one's tariff field really falls under its heading.
 */
export const RULING_SELECTION: Record<string, readonly string[]> = {
  '3924': ['N303036', 'N303037', 'N323051', 'N312887', 'N287024'],
  '3926': ['N289282', 'N341122', 'N300913', 'N103555', 'H296920'],
  '4202': ['N282153', 'N302343', 'N095006', 'N222079', 'N044483'],
  '6104': ['N007476', 'N018054', 'N365810', 'N360460', 'N353273'],
  '6109': ['N352158', 'H305865', 'N304245', 'N288044', 'N282645', 'N028178', 'N008657', 'N010257', 'N072625', 'N236794'],
  '6110': ['N290788', 'N252436', 'N322520', 'N132390', 'N005007'],
  '6203': ['N013949', 'N361641', 'N361483', 'N359582', 'N355808'],
  '6204': ['N364179', 'N361618', 'N361224', 'N356534', 'N342796'],
  '6302': ['N362388', 'N362359', 'N352117', 'N351110'],
  '6307': ['N045112', 'N366089', 'N365337', 'N365051'],
  '6402': ['N316681', 'N362528', 'N362166', 'N361892', 'N361820'],
  '6403': ['N330567', 'N365049', 'N346534', 'N345609', 'N342584'],
  '6404': ['N296080', 'N305498', 'N364108', 'N359450', 'N357157'],
  '7113': ['N295318', 'N293583'],
  '7117': ['N363470'],
  '8516': ['N357985', 'N354805', 'N326335', 'N326172'],
  '8517': ['N301247', 'N365265', 'N365110', 'N364989', 'N363296'],
  '8518': ['N045112'],
  '8543': ['N365488', 'N365162', 'N365136', 'N365087', 'N364628'],
  '9401': ['N365299', 'N364625', 'N363457', 'N362889', 'N361489'],
  '9403': ['N366142', 'N365562', 'N365466', 'N365028', 'N364817'],
  '9404': ['N363640', 'N360899', 'N360484'],
  '9503': ['N365745', 'N365641', 'N364364', 'N363701', 'N363652'],
  '9506': ['N364934', 'N364886', 'N364772', 'N361878', 'N361634'],
};
