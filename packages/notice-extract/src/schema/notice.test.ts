import { describe, expect, it } from 'vitest';
import { Fields } from '../../../../scripts/specimens/schema';
import { diffTrees, leafTree, withoutOracleKeys } from '../test/zod-tree';
import { loadTruth, SPECIMEN_IDS, wrapTruth, wrapTruthAsModel } from '../test/wrap';
import { ModelNotice, Notice } from './notice';

describe('Notice union on kind', () => {
  it.each(SPECIMEN_IDS)('parses %s wrapped in stated fields', (id) => {
    const truth = loadTruth(id);
    const r = Notice.safeParse(wrapTruth(truth));
    expect(r.error?.issues).toBeUndefined();
    expect(r.data?.kind).toBe(truth.kind);
  });

  it.each(SPECIMEN_IDS)('the model shape of %s (no prov) parses with ModelNotice, not with Notice', (id) => {
    const model = wrapTruthAsModel(loadTruth(id));
    expect(ModelNotice.safeParse(model).error?.issues).toBeUndefined();
    expect(Notice.safeParse(model).success).toBe(false);
    expect(ModelNotice.safeParse(wrapTruth(loadTruth(id))).success).toBe(false);
  });

  it('rejects kind unknown and an old kind name', () => {
    const s = wrapTruth(loadTruth('specimen-1-form28'));
    expect(Notice.safeParse({ ...s, kind: 'unknown' }).success).toBe(false);
    expect(Notice.safeParse({ ...s, kind: 'form28' }).success).toBe(false);
    expect(Notice.safeParse({ ...s, kind: 'cbp_form_29' }).success).toBe(false);
  });

  it('the whole union has the key tree, enums and regexes of the specimen schema minus oracle keys', () => {
    expect(diffTrees(withoutOracleKeys(leafTree(Fields)), leafTree(Notice))).toEqual([]);
  });
});
