import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './db';
import { htsCandidates, openTariff, rulingsFor } from './tariff';

/** A tiny index built from the real tariff-data schema, so the queries run against the same tables. */
function index(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(repoRoot(), 'packages', 'tariff-data', 'src', 'build', 'schema.sql'), 'utf8'));
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('edition', '2026 Revision 3');
  const hts = db.prepare('INSERT INTO hts_lines (seq, chapter, code, indent, description, general, special, other, units, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const src = (ch: string) => `data/hts/ch${ch}.json; 2026 Revision 3`;
  hts.run(1, '63', '6302', 0, 'Bed linen, table linen, toilet linen and kitchen linen', '', '', '', '[]', src('63'));
  hts.run(2, '63', '6302.91.00', 2, 'Toilet linen and kitchen linen, of terry towelling, of cotton', '9.1%', 'Free (AU)', '40%', '["doz.","kg"]', src('63'));
  hts.run(3, '63', '6302.93.20', 2, 'Kitchen towels of man-made fibers', '10.8%', '', '40%', '["doz."]', src('63'));
  hts.run(4, '42', '4202.32.10', 2, 'Wallets with outer surface of reinforced or laminated plastics', '12.1¢/kg + 4.6%', '', '', '[]', src('42'));
  hts.run(5, '42', '4202.32.10.00', 3, 'Card wallets', '', '', '', '["No."]', src('42'));
  hts.run(6, '85', '8509.80.20.00', 2, 'Kitchen waste disposers (disposals)', 'Free', '', '', '[]', src('85'));
  db.exec("INSERT INTO hts_fts(hts_fts) VALUES('rebuild')");
  const ruling = db.prepare('INSERT INTO rulings (number, date, title, hts_codes, text, url, source) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const code = db.prepare('INSERT INTO ruling_codes (number, code, heading) VALUES (?, ?, ?)');
  ruling.run('N362388', '2026-03-02', 'The tariff classification of kitchen towels from China', '6302.91.00', 'cotton terry kitchen towels', 'https://rulings.cbp.gov/ruling/N362388', 'x');
  code.run('N362388', '6302.91.00', '6302');
  ruling.run('N351110', '2025-07-15', 'The tariff classification of bath linen', '6302.60.00', 'bath towels of cotton', 'https://rulings.cbp.gov/ruling/N351110', 'x');
  code.run('N351110', '6302.60.00', '6302');
  ruling.run('N282153', '2017-01-10', 'The tariff classification of a card wallet', '4202.32.10', 'card wallet laminated plastic', 'https://rulings.cbp.gov/ruling/N282153', 'x');
  code.run('N282153', '4202.32.10', '4202');
  db.exec("INSERT INTO rulings_fts(rulings_fts) VALUES('rebuild')");
  return db;
}

describe('tariff index under Node (node:sqlite over the tariff-data index)', () => {
  it('lists the printed code first with its rate text verbatim and a tariff citation, then description matches', () => {
    const c = htsCandidates(index(), { hts: '6302.91.00', description: 'Kitchen towels' });
    expect(c[0]).toEqual({
      code: '6302.91.00',
      description: 'Toilet linen and kitchen linen, of terry towelling, of cotton',
      rate: '9.1%',
      source: 'data/hts/ch63.json; 2026 Revision 3',
      edition: '2026 Revision 3',
      printed: true,
    });
    expect(c.map((x) => x.code)).toEqual(['6302.91.00', '6302.93.20']);
    expect(c.every((x) => x.rate !== '')).toBe(true);
  });

  it('a statistical suffix with no rate of its own takes the rate line above it, cited to that line', () => {
    const [first] = htsCandidates(index(), { hts: '4202.32.10.00', description: null });
    expect(first).toMatchObject({ code: '4202.32.10.00', rate: '12.1¢/kg + 4.6%', printed: true });
  });

  it('a short description gets its parent line for context', () => {
    const [first] = htsCandidates(index(), { hts: '4202.32.10.00', description: null });
    expect(first!.description).toBe('Wallets with outer surface of reinforced or laminated plastics › Card wallets');
  });

  it('with a printed code, description matches stay in its chapter', () => {
    const c = htsCandidates(index(), { hts: '6302.91.00', description: 'kitchen waste towels' });
    expect(c.map((x) => x.code)).not.toContain('8509.80.20.00');
    expect(htsCandidates(index(), { hts: null, description: 'kitchen waste towels' }).map((x) => x.code)).toContain('8509.80.20.00');
  });

  it('CROSS rulings: same subheading first, then the heading, each with number, date, title and url', () => {
    const r = rulingsFor(index(), { hts: '6302.91.00', description: 'kitchen towels' });
    expect(r.map((x) => x.number)).toEqual(['N362388', 'N351110']);
    expect(r[0]).toEqual({
      number: 'N362388',
      date: '2026-03-02',
      title: 'The tariff classification of kitchen towels from China',
      url: 'https://rulings.cbp.gov/ruling/N362388',
    });
  });

  it('falls back to a text search when no ruling cites the heading, and never throws on FTS syntax', () => {
    const db = index();
    expect(rulingsFor(db, { hts: '9403.60.80', description: 'card "wallet" NEAR(' }).map((x) => x.number)).toEqual(['N282153']);
    expect(htsCandidates(db, { hts: 'nonsense', description: '*"' })).toEqual([]);
  });

  it('openTariff returns null when the index is not built', () => {
    expect(openTariff('/nonexistent/tariff.sqlite')).toBeNull();
  });
});
