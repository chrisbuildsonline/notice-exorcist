import { describe, expect, it } from 'vitest';
import { NOTICE_KINDS } from './index';

describe('notice-extract', () => {
  it('lists the notice kinds the extractor will accept', () => {
    expect(NOTICE_KINDS).toEqual(['form28', 'form29', 'courier']);
  });
});
