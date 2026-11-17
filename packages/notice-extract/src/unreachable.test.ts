import { describe, expect, it, vi } from 'vitest';
import { readConfig } from './config';
import { extractNotice } from './extract';
import { closedPort } from './test/stub-server';
import { specimenBytes } from './test/stub-provider';

describe('unreachable local model', () => {
  it('returns model_unreachable and never falls through to Bedrock, even with AWS env vars set', async () => {
    const env = {
      EXTRACT_BASE_URL: `${await closedPort()}/v1`,
      AWS_ACCESS_KEY_ID: 'test-access-key-id',
      AWS_SECRET_ACCESS_KEY: 'example-secret-not-real',
      AWS_REGION: 'us-east-1',
    };
    const loadBedrock = vi.fn(async () => {
      throw new Error('the Bedrock loader must not be called');
    });
    const r = await extractNotice({ bytes: specimenBytes('specimen-2-form29.png') }, { config: readConfig(env), loadBedrock });
    expect(r).toMatchObject({ ok: false, reason: 'model_unreachable' });
    expect(!r.ok && r.detail).toMatch(/ECONNREFUSED/);
    expect(loadBedrock).not.toHaveBeenCalled();
  });
});
