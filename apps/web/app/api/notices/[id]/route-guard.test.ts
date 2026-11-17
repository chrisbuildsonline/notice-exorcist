import { describe, expect, it, vi } from 'vitest';

// A notice whose figure lost its source: the route must refuse to send it.
vi.mock('../../../../lib/intake', () => ({ getNotice: () => ({ id: 'n1' }) }));
vi.mock('../../../../lib/notice-view', () => ({
  noticeView: () => ({ id: 'n1', assessment: { atStake: { value: '750.82', prov: 'computed', source: '' } } }),
}));

describe('GET /api/notices/[id] provenance guard', () => {
  it('returns 500 in test mode when a figure has no source', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://x/api/notices/n1'), { params: Promise.resolve({ id: 'n1' }) });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'unsourced_figure', path: 'assessment.atStake' });
  });
});
