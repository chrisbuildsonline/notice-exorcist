import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { SPECIMENS, migrate, openDb } from './db';

describe('db', () => {
  it('creates the schema and finds a ruling with an FTS5 query', () => {
    const db = openDb(':memory:');
    db.prepare('INSERT INTO rulings (number, date, hts, text) VALUES (?, ?, ?, ?)').run(
      'N312345',
      '2020-06-01',
      '6302.91.00',
      'The tariff classification of cotton waffle-weave kitchen towels from Pakistan',
    );
    const hits = db.prepare('SELECT number FROM rulings WHERE rulings MATCH ?').all('waffle AND towels');
    expect(hits).toEqual([{ number: 'N312345' }]);
  });

  it('has the notice, line, draft, approval and inbox token tables', () => {
    const db = openDb(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(['notices', 'lines', 'drafts', 'approvals', 'inbox_tokens']));
  });

  it('seeds the inbox token from the env and only once', () => {
    const db = openDb(':memory:', { inboxToken: 'abc' });
    migrate(db, { inboxToken: 'abc' });
    expect(db.prepare('SELECT token FROM inbox_tokens').all()).toEqual([{ token: 'abc' }]);
  });

  it('lists the bundled specimens, each with a recorded reading', () => {
    expect(SPECIMENS.map((s) => s.id)).toEqual(['specimen-2-form29', 'specimen-3-courier', 'specimen-1-form28']);
    for (const s of SPECIMENS) expect(existsSync(s.path), s.path).toBe(true);
  });
});
