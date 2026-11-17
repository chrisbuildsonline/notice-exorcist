import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Fields } from '../../../../scripts/specimens/schema';
import { diffTrees, leafTree, withoutOracleKeys } from '../test/zod-tree';
import { ACTION_TYPES, Iso, NOTICE_KINDS } from './common';
import { courierSchema, datesSchema, feeSchema, headerShape, lineSchema, statedTotalSchema } from './base';
import { Stated } from './field';

const specimen = withoutOracleKeys(leafTree(Fields));

/** Every base piece in one object, with the widest options, to compare with the specimen schema. */
const allBasePieces = z.object({
  kind: z.enum(NOTICE_KINDS),
  ...headerShape(Stated),
  actionType: Stated(z.enum(ACTION_TYPES), { nullable: true }),
  dates: datesSchema(Stated, { deadlineNullable: true }),
  courier: courierSchema(Stated).nullable(),
  informationRequested: z.array(Stated(z.string())),
  lines: z.array(lineSchema(Stated, { dutyNullable: true })),
  fees: z.array(feeSchema(Stated)),
  statedTotals: z.array(statedTotalSchema(Stated)),
});

describe('schema parity with scripts/specimens/schema.ts', () => {
  it('the specimen tree has the expected leaves, oracle keys removed', () => {
    expect([...specimen.keys()]).toContain('lines[].dutyStated');
    expect([...specimen.keys()]).not.toContain('lines[].expectedDuty');
    expect([...specimen.keys()]).not.toContain('specimenId');
    expect(specimen.get('fees[].kind')).toBe('enum courier_fee|hmf|mpf');
    expect(specimen.get('lines[].value')).toBe('string /^-?\\d+\\.\\d{2}$/');
  });

  it('base pieces have the same key tree, enums and regexes as the specimen schema minus oracle keys', () => {
    expect(diffTrees(specimen, leafTree(allBasePieces))).toEqual([]);
  });

  it('fails on drift: an extra key, a missing key, a changed regex or enum', () => {
    const extended = withoutOracleKeys(leafTree(Fields.extend({ totalComputed: z.string() })));
    expect(diffTrees(extended, leafTree(allBasePieces))).toEqual(['missing totalComputed (string)']);
    const omitted = withoutOracleKeys(leafTree(Fields.omit({ port: true })));
    expect(diffTrees(omitted, leafTree(allBasePieces))).toEqual(['extra port (string)']);
    const regex = withoutOracleKeys(leafTree(Fields.extend({ dates: z.object({ entry: z.string().regex(/^\d{8}$/), notice: Iso, responseDeadline: Iso }) })));
    expect(diffTrees(regex, leafTree(allBasePieces))).toHaveLength(1);
    const actionEnum = withoutOracleKeys(leafTree(Fields.extend({ actionType: z.enum(['rate_advance', 'liquidation']) })));
    expect(diffTrees(actionEnum, leafTree(allBasePieces))).toEqual(['actionType: expected enum liquidation|rate_advance, got enum rate_advance']);
  });
});
