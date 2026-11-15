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

/**
 * Filer codes (the first three characters of an entry number) used on specimens. Real filer codes are
 * assigned by CBP; these are invented, ZZ9 style, so a specimen entry number cannot point at a real entry.
 */
export const RESERVED_FAKE_FILER_CODES = ['ZZ9'] as const;

/** Every figure below is a literal typed by a person, never engine output (see design.md, Decisions). */
const specimen1: Specimen = {
  specimenId: 'specimen-1-form28',
  kind: 'cbp_form_28',
  noticeType: 'Request for Information',
  actionType: null,
  entryNumber: 'ZZ9-0417726-3',
  dates: { entry: '2026-10-05', notice: '2026-10-21', responseDeadline: '2026-11-20' },
  importer: { name: 'Hollowmere Home Goods LLC', address: '418 Larch Hollow Road, Asheville, NC 28801' },
  port: 'Savannah, GA',
  courier: null,
  informationRequested: [
    'Commercial invoice and packing list for every line on this entry',
    'Specification sheet giving the material and construction of each item',
    'Photographs of the kitchen towels showing the weave of the fabric',
    'Statement of whether the plates are sold for household or commercial use',
    'Proof of payment to the seller for the goods on this entry',
  ],
  lines: [
    {
      n: 1,
      description: 'Melamine dinner plates and bowls',
      hts: '3924.10.20.00',
      value: '3240.00',
      quantity: '410',
      unit: 'kg',
      rateText: '6.5%',
      dutyStated: null,
    },
    {
      n: 2,
      description: 'Cotton terry kitchen towels',
      hts: '6302.60.00',
      value: '1875.00',
      quantity: '150',
      unit: 'doz.',
      rateText: '9.1%',
      dutyStated: null,
    },
    {
      n: 3,
      description: 'Acacia wood kitchen carts',
      hts: '9403.60.80',
      value: '2160.00',
      quantity: '24',
      unit: 'No.',
      rateText: 'Free',
      dutyStated: null,
    },
  ],
  fees: [],
  statedTotals: [],
  notes: [],
};

const specimen2: Specimen = {
  specimenId: 'specimen-2-form29',
  kind: 'cbp_form_29',
  noticeType: 'Notice of Action',
  actionType: 'rate_advance',
  entryNumber: 'ZZ9-0423518-7',
  dates: { entry: '2026-10-08', notice: '2026-10-27', responseDeadline: '2026-11-16' },
  importer: { name: 'Fernhollow Supply LLC', address: '2210 Quarry Mill Drive, Boise, ID 83702' },
  port: 'Long Beach, CA',
  courier: null,
  informationRequested: [],
  lines: [
    {
      n: 1,
      description: 'Cotton waffle-weave kitchen towels',
      hts: '6302.91.00',
      value: '4815.00',
      quantity: '320',
      unit: 'doz.',
      rateText: '9.2%',
      // Planted: the rate applied to 4185.00, the entered value with two digits transposed.
      dutyStated: '385.02',
      plantedError: true,
      expectedDuty: '442.98',
    },
    {
      n: 2,
      description: 'Card wallets, outer surface of laminated plastic sheeting',
      hts: '4202.32.10.00',
      value: '2480.00',
      quantity: '186',
      unit: 'kg',
      rateText: '12.1¢/kg + 4.6%',
      dutyStated: '136.59',
    },
    {
      n: 3,
      description: 'Acacia wood side tables',
      hts: '9403.60.80',
      value: '3600.00',
      quantity: '40',
      unit: 'No.',
      rateText: 'Free',
      dutyStated: '0.00',
    },
    {
      n: 4,
      description: 'Melamine dinner plates',
      hts: '3924.10.20.00',
      value: '1950.00',
      quantity: '260',
      unit: 'kg',
      rateText: '6.5%',
      dutyStated: '126.75',
    },
  ],
  fees: [{ name: 'Merchandise Processing Fee', kind: 'mpf', stated: '44.50' }],
  statedTotals: [
    { name: 'Total entered value', stated: '12845.00' },
    { name: 'Total duty', stated: '648.36' },
  ],
  notes: [
    'Line 1 stated duty is a planted error: the rate is applied to the entered value with two digits transposed.',
    'Total duty is the arithmetic sum of the stated line duties, so it carries the planted error.',
  ],
};

export const SPECIMENS: Specimen[] = [specimen1, specimen2];
