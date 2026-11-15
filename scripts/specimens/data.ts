import type { Specimen } from './schema';

/**
 * HTS codes printed on the specimens, chosen from the built tariff index (`searchHts`, then `lookupHts`)
 * on 2026-11-15. `rateText` is the index `general` text copied character for character. Every rate is
 * one `parseRateText` supports. None of these lines prints an AD/CVD or Chapter 99 note.
 */
export const HTS_PICKS = [
  { hts: '3924.10.20.00', rateText: '6.5%', goods: 'plastic plates, cups, bowls and serving dishes' },
  { hts: '3924.10.40.00', rateText: '3.4%', goods: 'other plastic tableware and kitchenware' },
  { hts: '4202.32.10.00', rateText: '12.1¢/kg + 4.6%', goods: 'pocket or handbag articles, outer surface of reinforced or laminated plastic sheeting' },
  { hts: '6302.60.00', rateText: '9.1%', goods: 'toilet and kitchen linen of cotton terry toweling' },
  { hts: '6302.91.00', rateText: '9.2%', goods: 'other toilet and kitchen linen of cotton' },
  { hts: '6307.10.20', rateText: '5.3%', goods: 'other dishcloths, dusters and cleaning cloths' },
  { hts: '7117.19.90.00', rateText: '11%', goods: 'other imitation jewelry of base metal' },
  { hts: '9403.60.80', rateText: 'Free', goods: 'other wooden furniture' },
] as const;

export const SPECIMENS: Specimen[] = [];
