CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE hts_lines (
  seq INTEGER PRIMARY KEY,           -- source order across all chapters
  chapter TEXT NOT NULL,             -- '39', '61', ...
  code TEXT NOT NULL,                -- '6109.10.00.12', or '' for rows without a code
  indent INTEGER NOT NULL,
  description TEXT NOT NULL,
  general TEXT NOT NULL,             -- verbatim
  special TEXT NOT NULL,             -- verbatim
  other TEXT NOT NULL,               -- verbatim
  units TEXT NOT NULL,               -- JSON array as published, e.g. ["doz.","kg"]
  source TEXT NOT NULL               -- 'data/hts/ch61.json; <edition>'
);
CREATE INDEX hts_code ON hts_lines(code) WHERE code <> '';

CREATE TABLE rulings (
  number TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  hts_codes TEXT NOT NULL,           -- space-separated normalized codes
  text TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE ruling_codes (
  number TEXT NOT NULL REFERENCES rulings(number),
  code TEXT NOT NULL,
  heading TEXT NOT NULL,
  PRIMARY KEY (number, code)
);
CREATE INDEX ruling_heading ON ruling_codes(heading);

-- External-content FTS5 so snippet() can read the base rows. Filled once by 'rebuild' after the base tables.
CREATE VIRTUAL TABLE hts_fts USING fts5(
  description, content='hts_lines', content_rowid='seq', tokenize='porter unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE rulings_fts USING fts5(
  title, text, content='rulings', content_rowid='rowid', tokenize='porter unicode61 remove_diacritics 2');
