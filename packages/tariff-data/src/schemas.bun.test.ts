import { describe, expect, test } from 'bun:test';
import { CrossRuling, HtsExportRow, Manifest } from './schemas';

// Verbatim rows from https://hts.usitc.gov/reststop/exportList?from=6109&to=6110&format=JSON&styles=false (2026 HTS Revision 23).
const heading = {
  htsno: '6109',
  indent: '0',
  description: 'T-shirts, singlets, tank tops and similar garments, knitted or crocheted:',
  superior: null,
  units: [],
  general: '',
  special: '',
  other: '',
  footnotes: [],
  quotaQuantity: '',
  additionalDuties: '',
  addiitionalDuties: null,
};
const line = {
  htsno: '6109.10.00',
  indent: '1',
  description: 'Of cotton',
  superior: null,
  units: [],
  general: '16.5%',
  special: 'Free (AU,BH,CL,CO,IL,JO,KR,MA,OM,P,PA,PE,S,SG)',
  other: '90%',
  footnotes: [],
  quotaQuantity: null,
  additionalDuties: null,
  addiitionalDuties: null,
};

// Verbatim excerpt of https://rulings.cbp.gov/api/ruling/N338047 (text cut short, presigned `url` field dropped).
const ruling = {
  text: 'N338047 \r\rFebruary 22, 2024 \r\rCLA-2-90:OT:RR:NC:N2:212\r\rCATEGORY: Classification\r\rTARIFF NO.: 9004.90.0090; 9903.88.15\r\r',
  id: 214300,
  rulingNumber: 'N338047',
  subject: 'The tariff classification of children’s swim goggles from China',
  categories: null,
  rulingDate: '2024-02-22T00:00:00',
  collection: 'ny',
  tariffs: '9004.90.0090, 9903.88.15',
};

describe('HtsExportRow', () => {
  test('accepts real rows and keeps empty strings as empty strings', () => {
    const h = HtsExportRow.parse(heading);
    expect(h.general).toBe('');
    expect(h.special).toBe('');
    expect(HtsExportRow.parse(line).general).toBe('16.5%');
  });

  test('rejects a row missing general and names the field', () => {
    const { general: _, ...rest } = line;
    const r = HtsExportRow.safeParse(rest);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['general']);
  });

  test('rejects a null general instead of defaulting it', () => {
    expect(HtsExportRow.safeParse({ ...line, general: null }).success).toBe(false);
  });
});

describe('CrossRuling', () => {
  test('accepts a real ruling record', () => {
    expect(CrossRuling.parse(ruling).rulingNumber).toBe('N338047');
  });

  test('rejects a record missing text and names the field', () => {
    const { text: _, ...rest } = ruling;
    expect(CrossRuling.safeParse(rest).error?.issues[0]?.path).toEqual(['text']);
  });
});

describe('Manifest', () => {
  test('requires an edition and per-file url, timestamp and sha256', () => {
    const ok = {
      edition: '2026 HTS Revision 23',
      files: { 'hts/ch61.json': { url: 'https://hts.usitc.gov/x', retrievedAt: '2026-11-14T16:37:29.000Z', sha256: 'a'.repeat(64) } },
    };
    expect(Manifest.parse(ok).edition).toBe('2026 HTS Revision 23');
    expect(Manifest.safeParse({ files: ok.files }).success).toBe(false);
  });
});
