import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'crypto'
import type { Expects, Reason, Receipt, Row, RowLink, Step, Tab } from '../shared/types'
import { openDatabase, RECEIPT_TTL_MS } from './db'
import { databasePath } from './paths'

export interface StepInput {
  text: string
  expects?: Expects
}

export interface AddInput {
  text: string
  tab?: string
  link?: RowLink
  source?: string
  batch?: string
  body?: string
  context?: string
  steps?: Array<string | StepInput>
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
  body: string | null
  context: string | null
}

interface StepRecord {
  id: string
  position: number
  text: string
  done: number
  expects: string
  answer: string | null
}

const ROW_COLUMNS = 'id, tab, position, text, link_kind, link_target, source, batch, body, context'

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
          .prepare(`SELECT ${ROW_COLUMNS} FROM queue_rows WHERE tab = ? ORDER BY position`)
          .all(tab)
      : // Across tabs, rows follow the tab order shown in the window rather
        // than the alphabetical order of the tab ids.
        this.db
          .prepare(
            `SELECT r.id, r.tab, r.position, r.text, r.link_kind, r.link_target, r.source,
                      r.batch, r.body, r.context
               FROM queue_rows r
               JOIN queue_tabs t ON t.id = r.tab
               ORDER BY t.position, r.position`
          )
          .all()) as unknown as RowRecord[]

    return records.map((record) => this.hydrate(record))
  }

  row(id: string): Row | null {
    const record = this.db
      .prepare(`SELECT ${ROW_COLUMNS} FROM queue_rows WHERE id = ?`)
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
  add(input: AddInput, now = Date.now()): Row {
    const tab = input.tab ? this.ensureTab(input.tab) : this.orderedTab()

    const duplicate = input.link
      ? (this.db
          .prepare('SELECT id FROM queue_rows WHERE link_target = ? LIMIT 1')
          .get(input.link.target) as { id: string } | undefined)
      : undefined

    if (duplicate) {
      const replacesSteps = (input.steps?.length ?? 0) > 0

      // Replacing the steps discards work you may already have done, so the
      // previous state leaves a receipt saying it was superseded.
      if (replacesSteps) this.writeReceipt(duplicate.id, 'superseded', undefined, now)

      this.db
        .prepare(
          'UPDATE queue_rows SET text = ?, source = ?, batch = ?, body = ?, context = ? WHERE id = ?'
        )
        .run(
          input.text,
          input.source ?? null,
          input.batch ?? null,
          input.body ?? null,
          input.context ?? null,
          duplicate.id
        )

      if (replacesSteps) {
        this.db.prepare('DELETE FROM queue_steps WHERE row_id = ?').run(duplicate.id)
        this.insertSteps(duplicate.id, input.steps as Array<string | StepInput>)
      }

      return this.row(duplicate.id) as Row
    }

    const position = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM queue_rows WHERE tab = ?')
      .get(tab) as { p: number } | undefined

    const id = randomUUID()
    this.db
      .prepare(
        `INSERT INTO queue_rows (${ROW_COLUMNS}, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        input.body ?? null,
        input.context ?? null,
        now
      )

    if (input.steps) this.insertSteps(id, input.steps)

    return this.row(id) as Row
  }

  /** Active row plus its next unchecked step — all an agent needs to ask for. */
  next(): { row: Row; step: Step | null } | null {
    const record = this.db
      .prepare(`SELECT ${ROW_COLUMNS} FROM queue_rows WHERE tab = ? ORDER BY position LIMIT 1`)
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

  /** Records what you found. Only steps that asked for an answer have a field. */
  setAnswer(rowId: string, stepId: string, answer: string): Row | null {
    this.db
      .prepare('UPDATE queue_steps SET answer = ? WHERE id = ? AND row_id = ?')
      .run(answer.trim() === '' ? null : answer, stepId, rowId)
    return this.row(rowId)
  }

  /**
   * Checks the next unchecked step. Returns the row and whether that was the
   * last one — the caller decides when to complete it, so the window can offer
   * an undo before the row goes.
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

  /**
   * Takes the row out of the queue and leaves a receipt behind. The reason is
   * the part that matters: without it a receiver reads "the row is gone" as
   * "the work passed", which is wrong whenever you cancelled it or a resolver
   * closed it.
   */
  complete(id: string, reason: Reason, note?: string, now = Date.now()): Receipt | null {
    const receipt = this.writeReceipt(id, reason, note, now)
    if (!receipt) return null

    this.db.prepare('DELETE FROM queue_steps WHERE row_id = ?').run(id)
    this.db.prepare('DELETE FROM queue_rows WHERE id = ?').run(id)

    return receipt
  }

  /** Removing a row by hand is a cancellation, not a completion. */
  remove(id: string): boolean {
    return this.complete(id, 'cancelled') !== null
  }

  receipt(id: string): Receipt | null {
    const record = this.db.prepare('SELECT payload FROM receipts WHERE id = ?').get(id) as
      { payload: string } | undefined

    return record ? (JSON.parse(record.payload) as Receipt) : null
  }

  /** The most recent receipt for a row, which is what a waiting thread asks for. */
  receiptForRow(rowId: string): Receipt | null {
    const record = this.db
      .prepare('SELECT payload FROM receipts WHERE row_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(rowId) as { payload: string } | undefined

    return record ? (JSON.parse(record.payload) as Receipt) : null
  }

  /**
   * Finds a receipt from an id prefix, matching either the receipt or the row
   * it came from — by the time you ask, the row id is the one you still have.
   */
  resolveReceipt(prefix: string): Receipt | null {
    const record = this.db
      .prepare(
        'SELECT payload FROM receipts WHERE id LIKE ?1 OR row_id LIKE ?1 ORDER BY created_at DESC LIMIT 1'
      )
      .get(`${prefix}%`) as { payload: string } | undefined

    return record ? (JSON.parse(record.payload) as Receipt) : null
  }

  receipts(since = 0): Receipt[] {
    const records = this.db
      .prepare('SELECT payload FROM receipts WHERE created_at >= ? ORDER BY created_at')
      .all(since) as unknown as Array<{ payload: string }>

    return records.map((record) => JSON.parse(record.payload) as Receipt)
  }

  /**
   * Registers a thread as blocked on a row. The window shows a marker for it:
   * when you drain the queue on a Monday, the row somebody is stuck on is the
   * one worth taking first.
   */
  addWaiter(rowId: string, ttlMs: number, now = Date.now()): string {
    const id = randomUUID()
    this.db
      .prepare('INSERT INTO waiters (id, row_id, since, expires_at) VALUES (?, ?, ?, ?)')
      .run(id, rowId, now, now + ttlMs)
    return id
  }

  removeWaiter(id: string): void {
    this.db.prepare('DELETE FROM waiters WHERE id = ?').run(id)
  }

  /**
   * Forgets receipts nobody fetched and waiters whose thread is long gone. Runs
   * on open; the queue must not accumulate a history behind your back.
   */
  prune(now = Date.now(), ttlMs = RECEIPT_TTL_MS): void {
    this.db.prepare('DELETE FROM receipts WHERE created_at < ?').run(now - ttlMs)
    this.db.prepare('DELETE FROM waiters WHERE expires_at < ?').run(now)
  }

  private awaitedRows(now = Date.now()): Set<string> {
    const records = this.db
      .prepare('SELECT DISTINCT row_id FROM waiters WHERE expires_at > ?')
      .all(now) as unknown as Array<{ row_id: string }>

    return new Set(records.map((record) => record.row_id))
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

  /**
   * Rewrites the order of a tab from a list of ids. The window sends the whole
   * order after a drag rather than a from/to pair, so a dropped or stale id
   * cannot leave the queue half-sorted. Ids that are not in the tab are
   * ignored, and rows the caller left out keep their relative order at the end.
   */
  reorder(tab: string, ids: string[]): Row[] {
    const current = this.rows(tab)
    const known = new Set(current.map((row) => row.id))
    const wanted = ids.filter((id) => known.has(id))
    const rest = current.filter((row) => !wanted.includes(row.id)).map((row) => row.id)

    const update = this.db.prepare('UPDATE queue_rows SET position = ? WHERE id = ?')
    ;[...wanted, ...rest].forEach((id, index) => update.run(index, id))

    return this.rows(tab)
  }

  private writeReceipt(
    rowId: string,
    reason: Reason,
    note: string | undefined,
    now: number
  ): Receipt | null {
    const row = this.row(rowId)
    if (!row) return null

    const receipt: Receipt = {
      id: randomUUID(),
      rowId: row.id,
      reason,
      createdAt: now,
      text: row.text,
      link: row.link,
      source: row.source,
      context: row.context,
      note: note?.trim() || undefined,
      steps: row.steps.map((step) => ({
        text: step.text,
        done: step.done,
        answer: step.answer
      }))
    }

    this.db
      .prepare(
        'INSERT INTO receipts (id, row_id, reason, created_at, payload) VALUES (?, ?, ?, ?, ?)'
      )
      .run(receipt.id, receipt.rowId, receipt.reason, receipt.createdAt, JSON.stringify(receipt))

    return receipt
  }

  private insertSteps(rowId: string, steps: Array<string | StepInput>): void {
    const insert = this.db.prepare(
      'INSERT INTO queue_steps (id, row_id, position, text, done, expects) VALUES (?, ?, ?, ?, 0, ?)'
    )

    steps.forEach((step, index) => {
      const value = typeof step === 'string' ? { text: step } : step
      insert.run(randomUUID(), rowId, index, value.text, value.expects ?? 'none')
    })
  }

  private hydrate(record: RowRecord): Row {
    const steps = this.db
      .prepare(
        'SELECT id, position, text, done, expects, answer FROM queue_steps WHERE row_id = ? ORDER BY position'
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
      body: record.body ?? undefined,
      context: record.context ?? undefined,
      awaited: this.awaitedRows().has(record.id),
      steps: steps.map((step) => ({
        id: step.id,
        text: step.text,
        done: step.done === 1,
        expects: (step.expects as Expects) ?? 'none',
        answer: step.answer ?? undefined
      }))
    }
  }
}
