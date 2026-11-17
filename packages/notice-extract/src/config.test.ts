import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

describe('readConfig', () => {
  it('defaults: local provider, live mode, qwen2.5vl:7b at localhost:11434/v1, 120 s, 5 pages', () => {
    expect(readConfig({})).toEqual({
      provider: 'local',
      mode: 'live',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5vl:7b',
      timeoutMs: 120000,
      maxPages: 5,
      live: 'auto',
      log: false,
    });
  });

  it('treats empty strings as unset', () => {
    expect(readConfig({ EXTRACT_MODEL: '', EXTRACT_PROVIDER: '' }).model).toBe('qwen2.5vl:7b');
  });

  it('reads every override', () => {
    expect(
      readConfig({
        EXTRACT_PROVIDER: 'bedrock',
        EXTRACT_MODE: 'record',
        EXTRACT_BASE_URL: 'http://127.0.0.1:9999/v1',
        EXTRACT_MODEL: 'llava:13b',
        EXTRACT_TIMEOUT_MS: '600000',
        EXTRACT_MAX_PAGES: '0',
        EXTRACT_LIVE: 'require',
        EXTRACT_LOG: '1',
      }),
    ).toEqual({
      log: true,
      provider: 'bedrock',
      mode: 'record',
      baseUrl: 'http://127.0.0.1:9999/v1',
      model: 'llava:13b',
      timeoutMs: 600000,
      maxPages: 0,
      live: 'require',
    });
    expect(readConfig({ EXTRACT_MODE: 'fixture' }).mode).toBe('fixture');
  });

  it.each([
    ['EXTRACT_PROVIDER', 'openai'],
    ['EXTRACT_MODE', 'replay'],
    ['EXTRACT_BASE_URL', 'not a url'],
    ['EXTRACT_TIMEOUT_MS', '-5'],
    ['EXTRACT_TIMEOUT_MS', '12s'],
    ['EXTRACT_MAX_PAGES', '2.5'],
    ['EXTRACT_LIVE', 'yes'],
  ])('throws on invalid %s=%s', (key, value) => {
    expect(() => readConfig({ [key]: value })).toThrow(key);
  });
});
