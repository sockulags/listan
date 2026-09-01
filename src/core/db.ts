import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

// 'rows' and 'steps' are close enough to SQLite keywords to be worth avoiding;
// the tables carry a prefix while the domain language stays "rad" and "steg".
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS queue_tabs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_ordered INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queue_rows (
    id TEXT PRIMARY KEY,
    tab TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    link_kind TEXT,
    link_target TEXT,
    source TEXT,
    batch TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queue_steps (
    id TEXT PRIMARY KEY,
    row_id TEXT NOT NULL REFERENCES queue_rows(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS queue_rows_tab ON queue_rows(tab, position);
  CREATE INDEX IF NOT EXISTS queue_rows_link ON queue_rows(link_target);
  CREATE INDEX IF NOT EXISTS queue_steps_row ON queue_steps(row_id, position);
`

/** The tabs a fresh queue starts with. Exactly one of them is ordered. */
const SEED_TABS: Array<[string, string, number, number]> = [
  ['prio', 'Prio', 1, 0],
  ['ovrigt', 'Övrigt', 0, 1]
]

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)

  const seed = db.prepare(
    'INSERT OR IGNORE INTO queue_tabs (id, name, is_ordered, position) VALUES (?, ?, ?, ?)'
  )
  for (const tab of SEED_TABS) seed.run(...tab)

  return db
}
