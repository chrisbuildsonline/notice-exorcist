import { describe, expect, it } from 'vitest';
import { NOTICE_KINDS } from './index';

describe('notice-extract', () => {
  it('lists the notice kinds the extractor will accept, named as in the specimen schema', () => {
    expect(NOTICE_KINDS).toEqual(['cbp_form_28', 'cbp_form_29', 'courier_duty_invoice']);
  });
});
