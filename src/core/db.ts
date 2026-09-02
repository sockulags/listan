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

  -- Receipts live outside the queue: the queue forgets a row the moment it is
  -- drained, while the receipt survives long enough for an agent to fetch it.
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    row_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    payload TEXT NOT NULL
  );

  -- One entry per thread currently blocked on a row through listan wait.
  CREATE TABLE IF NOT EXISTS waiters (
    id TEXT PRIMARY KEY,
    row_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'En agent',
    since INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS queue_rows_tab ON queue_rows(tab, position);
  CREATE INDEX IF NOT EXISTS queue_rows_link ON queue_rows(link_target);
  CREATE INDEX IF NOT EXISTS queue_steps_row ON queue_steps(row_id, position);
  CREATE INDEX IF NOT EXISTS receipts_row ON receipts(row_id);
  CREATE INDEX IF NOT EXISTS receipts_created ON receipts(created_at);
  CREATE INDEX IF NOT EXISTS waiters_row ON waiters(row_id);
`

/** Columns added after the first release, applied to databases already in use. */
const ADDITIONS: Array<[string, string, string]> = [
  ['queue_rows', 'body', 'TEXT'],
  ['queue_rows', 'context', 'TEXT'],
  ['queue_rows', 'webhook', 'TEXT'],
  ['queue_steps', 'expects', "TEXT NOT NULL DEFAULT 'none'"],
  ['queue_steps', 'answer', 'TEXT'],
  ['waiters', 'label', "TEXT NOT NULL DEFAULT 'En agent'"]
]

/** The tabs a fresh queue starts with. Exactly one of them is ordered. */
const SEED_TABS: Array<[string, string, number, number]> = [
  ['prio', 'Prio', 1, 0],
  ['ovrigt', 'Övrigt', 0, 1]
]

/** Receipts nobody fetched are forgotten; the queue does not grow a history. */
export const RECEIPT_TTL_MS = 14 * 24 * 60 * 60 * 1000

function addMissingColumns(db: DatabaseSync): void {
  for (const [table, column, type] of ADDITIONS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{
      name: string
    }>

    if (!columns.some((entry) => entry.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    }
  }
}

export function openDatabase(path: string, now = Date.now()): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  addMissingColumns(db)

  const seed = db.prepare(
    'INSERT OR IGNORE INTO queue_tabs (id, name, is_ordered, position) VALUES (?, ?, ?, ?)'
  )
  for (const tab of SEED_TABS) seed.run(...tab)

  db.prepare('DELETE FROM receipts WHERE created_at < ?').run(now - RECEIPT_TTL_MS)
  db.prepare('DELETE FROM waiters WHERE expires_at < ?').run(now)

  return db
}
