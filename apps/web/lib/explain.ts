import type { AssessedLine } from './assess';
import { guardExplanation } from './explanation-guard';

/**
 * The plain-English "What this means" for a line, from the engine's state alone. It quotes no money:
 * figures sit beside it in <Figure>. The only numbers it may quote are the line's printed rate text and
 * HTS code, and it passes the same guard model-written text would (R4.11).
 */
export function explainLine(l: AssessedLine): string {
  const rate = l.rateText ? `the ${l.rateText} rate printed on the notice` : 'the sourced fee table';
  const what = l.rateText ? 'this line' : 'this fee';
  const text = {
    disagrees: `The notice's figure for ${what} does not match ${rate}. Duty-engine recomputed it from the values on the notice. The notice figure stays as printed, with the recomputed one beside it.`,
    verified: `The notice's figure for ${what} matches ${rate}. Nothing to dispute here.`,
    unverified: `Duty-engine could not check ${what} yet: the notice does not print everything the calculation needs.`,
    confirm: `The reader was not sure of some values on ${what}. Confirm or correct them and duty-engine will check it.`,
    unsupported: `Duty-engine cannot check this kind of charge, so it is shown exactly as printed and counted as stated.`,
  }[l.state];
  return guardExplanation(text, [l.rateText, l.hts].filter((s): s is string => !!s)).text;
}
