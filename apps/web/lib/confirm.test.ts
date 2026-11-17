import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../app/api/notices/[id]/confirm/route';
import { confirmationsFor, confirmField } from './confirm';
import { getDb } from './db';
import { fileNotice, getNotice } from './intake';
import { noticeView } from './notice-view';
import { freshDataDir, specimenBytes } from './test-env';

async function filed(file: string, flag: string[] = []): Promise<string> {
  const { id, settled } = fileNotice({ bytes: specimenBytes(file), filename: file, source: 'upload' });
  await settled;
  // Mark fields as the reader would when unsure (fixtures are all read with high confidence).
  const r = JSON.parse(getNotice(id)!.extracted_json!);
  for (const p of flag) {
    const leaf = p.split(/\.|(?=\[)/).reduce((o: any, k: string) => (k.startsWith('[') ? o[Number(k.slice(1, -1))] : o[k]), r.notice);
    leaf.needs_confirmation = true;
  }
  getDb().prepare('UPDATE notices SET extracted_json = ? WHERE id = ?').run(JSON.stringify(r), id);
  return id;
}

const view = (id: string) => noticeView(getNotice(id)!, confirmationsFor(id));

describe('confirm flow (R4.9)', () => {
  beforeEach(() => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
  });

  it('a line with a low-confidence input shows Confirm and is not calculated until confirmed', async () => {
    const id = await filed('specimen-2-form29.pdf', ['lines[0].rateText']);
    const before = view(id).assessment!;
    expect(before.lines[0]).toMatchObject({ state: 'confirm', computed: null, difference: null });
    expect(before.lines[0]!.confirm).toEqual([{ path: 'lines[0].rateText', label: 'Rate', read: '9.2%', source: 'page 1' }]);
    expect(before.status).toEqual({ kind: 'unverified' });
    // the printed total is shown, but nothing is recomputed while a line in it is unconfirmed
    expect(before.totals.statedTotal).toMatchObject({ value: '648.36', prov: 'stated' });
    expect(before.totals.computedTotal).toBeNull();

    expect(confirmField(id, 'lines[0].rateText', '9.2%')).toEqual({ ok: true });
    const after = view(id).assessment!;
    expect(after.lines[0]).toMatchObject({ state: 'disagrees', confirm: [] });
    expect(after.lines[0]!.stated).toMatchObject({ value: '385.02', prov: 'stated' });
    expect(after.lines[0]!.computed).toMatchObject({ value: '442.98', prov: 'computed' });
    expect(after.totals).toMatchObject({
      name: 'Total duty',
      statedTotal: { value: '648.36', prov: 'stated' },
      computedTotal: { value: '706.32', prov: 'computed' },
      difference: { value: '57.96', prov: 'computed' },
      flagged: false,
    });
  });

  it('a corrected value is used and its source says the user confirmed it', async () => {
    const id = await filed('specimen-2-form29.pdf', ['lines[0].dutyStated']);
    expect(confirmField(id, 'lines[0].dutyStated', '442.98')).toEqual({ ok: true });
    const line = view(id).assessment!.lines[0]!;
    expect(line.state).toBe('verified');
    expect(line.stated).toMatchObject({ value: '442.98', prov: 'stated', source: 'page 1 · confirmed by you' });
  });

  it('rejects an unknown notice, a field that is not flagged, and a value of the wrong shape', async () => {
    const id = await filed('specimen-2-form29.pdf', ['lines[0].dutyStated']);
    expect(confirmField('nope', 'lines[0].dutyStated', '1.00')).toMatchObject({ ok: false, status: 404 });
    expect(confirmField(id, 'lines[1].dutyStated', '1.00')).toMatchObject({ ok: false, status: 409 });
    expect(confirmField(id, 'lines[0].dutyStated', 'about 40')).toMatchObject({ ok: false, status: 400 });
    expect(confirmField(id, 'constructor', 'x')).toMatchObject({ ok: false, status: 409 });
    expect(confirmationsFor(id)).toEqual([]);
  });

  it('never presents a flagged printed total as the notice total; it is listed as a flagged field', async () => {
    const id = await filed('specimen-2-form29.pdf', ['statedTotals[1].stated']);
    const a = view(id).assessment!;
    expect(a.totals).toMatchObject({ name: 'Total duty', statedTotal: null, difference: null, flagged: true });
    expect(a.flags).toContainEqual({ path: 'statedTotals[1].stated', label: 'Total duty', read: '648.36', source: 'page 1' });
  });

  it('courier: the payable total is recomputed with the unchecked courier fee as stated, honesty flags are listed', async () => {
    const id = await filed('specimen-3-courier.pdf');
    const a = view(id).assessment!;
    expect(a.totals).toMatchObject({
      name: 'Total payable',
      statedTotal: { value: '175.29', prov: 'stated' },
      computedTotal: { value: '202.32', prov: 'computed' },
      difference: { value: '27.03', prov: 'computed' },
    });
    expect(a.flags.map((f) => f.path)).toEqual(expect.arrayContaining(['importer.name', 'importer.address']));
  });

  it('POST /api/notices/[id]/confirm confirms and returns the recalculated notice, sourced', async () => {
    const id = await filed('specimen-2-form29.pdf', ['lines[0].rateText']);
    const post = (body: unknown) =>
      POST(new Request(`http://x/api/notices/${id}/confirm`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), {
        params: Promise.resolve({ id }),
      });
    expect((await post({ path: 'lines[0].rateText' })).status).toBe(400);
    const res = await post({ path: 'lines[0].rateText', value: '9.2%' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { assessment: { lines: { state: string }[] } };
    expect(body.assessment.lines[0]!.state).toBe('disagrees');
  });
});
