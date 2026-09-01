import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'crypto'
import type { Row, RowLink, Step, Tab } from '../shared/types'
import { openDatabase } from './db'
import { databasePath } from './paths'

export interface AddInput {
  text: string
  tab?: string
  link?: RowLink
  source?: string
  batch?: string
  steps?: string[]
}

interface TabRecord {
  id: string
  name: string
  is_ordered: number
  position: number
}

interface RowRecord {
  id: string
  tab: string
  position: number
  text: string
  link_kind: string | null
  link_target: string | null
  source: string | null
  batch: string | null
}

interface StepRecord {
  id: string
  row_id: string
  position: number
  text: string
  done: number
}

/** Tab ids are slugs so that `--tab Jobb` and `--tab jobb` mean the same pile. */
export function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export class Store {
  private db: DatabaseSync

  constructor(path: string = databasePath()) {
    this.db = openDatabase(path)
  }

  close(): void {
    this.db.close()
  }

  tabs(): Tab[] {
    const records = this.db
      .prepare('SELECT id, name, is_ordered, position FROM queue_tabs ORDER BY position')
      .all() as unknown as TabRecord[]

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      ordered: record.is_ordered === 1
    }))
  }

  /** Creates the tab if it does not exist yet. New tabs are unordered piles. */
  ensureTab(name: string): string {
    const id = slug(name)
    const existing = this.db.prepare('SELECT id FROM queue_tabs WHERE id = ?').get(id)
    if (existing) return id

    const next = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM queue_tabs')
      .get() as { p: number } | undefined

    this.db
      .prepare('INSERT INTO queue_tabs (id, name, is_ordered, position) VALUES (?, ?, 0, ?)')
      .run(id, name, next?.p ?? 0)

    return id
  }

  /** The one tab whose order is a queue. Everything else is a pile. */
  orderedTab(): string {
    const record = this.db
      .prepare('SELECT id FROM queue_tabs WHERE is_ordered = 1 ORDER BY position LIMIT 1')
      .get() as { id: string } | undefined
    return record?.id ?? 'prio'
  }

  rows(tab?: string): Row[] {
    const records = (tab
      ? this.db
          .prepare(
            'SELECT id, tab, position, text, link_kind, link_target, source, batch FROM queue_rows WHERE tab = ? ORDER BY position'
          )
          .all(tab)
      : // Across tabs, rows follow the tab order shown in the window rather
        // than the alphabetical order of the tab ids.
        this.db
          .prepare(
            `SELECT r.id, r.tab, r.position, r.text, r.link_kind, r.link_target, r.source, r.batch
               FROM queue_rows r
               JOIN queue_tabs t ON t.id = r.tab
               ORDER BY t.position, r.position`
          )
          .all()) as unknown as RowRecord[]

    return records.map((record) => this.hydrate(record))
  }

  row(id: string): Row | null {
    const record = this.db
      .prepare(
        'SELECT id, tab, position, text, link_kind, link_target, source, batch FROM queue_rows WHERE id = ?'
      )
      .get(id) as unknown as RowRecord | undefined

    return record ? this.hydrate(record) : null
  }

  /**
   * Finds a row by an unambiguous id prefix. Full uuids are unusable at a
   * prompt, so the CLI prints and accepts the first characters instead.
   */
  resolve(prefix: string): Row | null {
    const matches = this.db
      .prepare('SELECT id FROM queue_rows WHERE id LIKE ? LIMIT 2')
      .all(`${prefix}%`) as unknown as Array<{ id: string }>

    return matches.length === 1 ? this.row(matches[0].id) : null
  }

  /**
   * Adds a row. A link that is already in the queue updates that row instead of
   * adding a second one — with several agent threads running, a thread that
   * repeats itself would otherwise leave duplicates behind.
   */
  add(input: AddInput): Row {
    const tab = input.tab ? this.ensureTab(input.tab) : this.orderedTab()

    const duplicate = input.link
      ? (this.db
          .prepare('SELECT id FROM queue_rows WHERE link_target = ? LIMIT 1')
          .get(input.link.target) as { id: string } | undefined)
      : undefined

    if (duplicate) {
      this.db
        .prepare('UPDATE queue_rows SET text = ?, source = ?, batch = ? WHERE id = ?')
        .run(input.text, input.source ?? null, input.batch ?? null, duplicate.id)

      if (input.steps && input.steps.length > 0) {
        this.db.prepare('DELETE FROM queue_steps WHERE row_id = ?').run(duplicate.id)
        this.insertSteps(duplicate.id, input.steps)
      }

      return this.row(duplicate.id) as Row
    }

    const position = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM queue_rows WHERE tab = ?')
      .get(tab) as { p: number } | undefined

    const id = randomUUID()
    this.db
      .prepare(
        'INSERT INTO queue_rows (id, tab, position, text, link_kind, link_target, source, batch, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        tab,
        position?.p ?? 0,
        input.text,
        input.link?.kind ?? null,
        input.link?.target ?? null,
        input.source ?? null,
        input.batch ?? null,
        Date.now()
      )

    if (input.steps) this.insertSteps(id, input.steps)

    return this.row(id) as Row
  }

  /** Active row plus its next unchecked step — all an agent needs to ask for. */
  next(): { row: Row; step: Step | null } | null {
    const record = this.db
      .prepare(
        'SELECT id, tab, position, text, link_kind, link_target, source, batch FROM queue_rows WHERE tab = ? ORDER BY position LIMIT 1'
      )
      .get(this.orderedTab()) as unknown as RowRecord | undefined

    if (!record) return null

    const row = this.hydrate(record)
    return { row, step: row.steps.find((step) => !step.done) ?? null }
  }

  setStep(rowId: string, stepId: string, done: boolean): Row | null {
    this.db
      .prepare('UPDATE queue_steps SET done = ? WHERE id = ? AND row_id = ?')
      .run(done ? 1 : 0, stepId, rowId)
    return this.row(rowId)
  }

  /**
   * Checks the next unchecked step. Returns the row and whether that was the
   * last one — the caller decides when to remove it, so the window can offer
   * an undo before it goes.
   */
  check(rowId: string): { row: Row; complete: boolean } | null {
    const row = this.row(rowId)
    if (!row) return null

    const pending = row.steps.find((step) => !step.done)
    if (pending) this.setStep(rowId, pending.id, true)

    const updated = this.row(rowId) as Row
    const complete = updated.steps.length === 0 || updated.steps.every((step) => step.done)
    return { row: updated, complete }
  }

  remove(id: string): boolean {
    this.db.prepare('DELETE FROM queue_steps WHERE row_id = ?').run(id)
    const result = this.db.prepare('DELETE FROM queue_rows WHERE id = ?').run(id)
    return result.changes > 0
  }

  /** Sends a row to the back of its tab, or to the back of another tab. */
  requeue(id: string, tab?: string): Row | null {
    const row = this.row(id)
    if (!row) return null

    const target = tab ? this.ensureTab(tab) : row.tab
    const position = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM queue_rows WHERE tab = ?')
      .get(target) as { p: number } | undefined

    this.db
      .prepare('UPDATE queue_rows SET tab = ?, position = ? WHERE id = ?')
      .run(target, position?.p ?? 0, id)

    return this.row(id)
  }

  private insertSteps(rowId: string, steps: string[]): void {
    const insert = this.db.prepare(
      'INSERT INTO queue_steps (id, row_id, position, text, done) VALUES (?, ?, ?, ?, 0)'
    )
    steps.forEach((text, index) => insert.run(randomUUID(), rowId, index, text))
  }

  private hydrate(record: RowRecord): Row {
    const steps = this.db
      .prepare(
        'SELECT id, row_id, position, text, done FROM queue_steps WHERE row_id = ? ORDER BY position'
      )
      .all(record.id) as unknown as StepRecord[]

    return {
      id: record.id,
      tab: record.tab,
      position: record.position,
      text: record.text,
      link:
        record.link_kind && record.link_target
          ? { kind: record.link_kind as RowLink['kind'], target: record.link_target }
          : undefined,
      source: record.source ?? undefined,
      batch: record.batch ?? undefined,
      steps: steps.map((step) => ({ id: step.id, text: step.text, done: step.done === 1 }))
    }
  }
}
