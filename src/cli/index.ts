#!/usr/bin/env node
import { readFileSync, watch } from 'fs'
import type { Receipt, Row, RowLink } from '../shared/types'
import { dataDir } from '../core/paths'
import { duration, flag, parse } from './args'

// node:sqlite prints an ExperimentalWarning the moment it is loaded, which
// would put a stack trace in front of every agent that calls the CLI. The
// filter has to be installed before the module is required, so the store is
// pulled in lazily rather than imported at the top.
process.removeAllListeners('warning')
process.on('warning', (warning) => {
  if (warning.name !== 'ExperimentalWarning') process.stderr.write(`${warning.stack}\n`)
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Store, slug } = require('../core/store') as typeof import('../core/store')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { render } = require('../core/receipt') as typeof import('../core/receipt')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readSettings } = require('../core/settings') as typeof import('../core/settings')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isAllowedWebhook } = require('../core/webhook') as typeof import('../core/webhook')

const USAGE = `listan — kön för de manuella stegen dina agenter lämnar efter sig

  listan add <text> [--tab T] [--link URL] [--fil SÖKVÄG] [--kommando K]
                    [--step S ...] [--fråga F ...] [--brief MD] [--kontext K]
                    [--källa K] [--batch B] [--webhook URL] [--wait 30m]
  listan add                     läser en rad per rad från stdin
  listan list [--tab T]
  listan next                    aktiv rad plus nästa obockade steg
  listan check [id]              bockar nästa steg, utan id på aktiva raden
  listan rm <id>                 tar bort raden som avbruten
  listan requeue <id> [--tab T]  skickar raden sist i sin flik
  listan result <id> [--format markdown|json|prompt|answers]
  listan results [--sedan MS] [--format ...]
  listan wait <id> [--timeout 30m] [--väntare Namn]

  --step lägger ett steg, --fråga ett steg som vill ha ett skrivet svar.
  --brief är markdown som visas när raden öppnas i eget fönster.
  --kontext är vad nästa agent behöver veta om tråden inte finns kvar.
  --json på valfritt kommando ger maskinläsbar utdata.
  Id:n får förkortas så länge prefixet är unikt.

  --wait på add lägger raden och väntar på den i ett anrop, utan lucka emellan.
  wait blockerar tills raden avslutas och skriver då ut kvittot. Standard 30m,
  tak 4h. Kör det i bakgrunden om värden stöder det. Avslutar med kod 2 om
  tiden går ut, 3 om väntan är avstängd i inställningarna.

  --webhook måste finnas i tillåtlistan i inställningarna, annars avvisas den.`

// Half an hour by default because the common case is CI running against a test
// environment and you confirming afterwards; ten minutes never covered that.
// The ceiling is four hours — past the prompt cache, resuming costs one full
// re-read of the thread, which is still far cheaper than polling would be.
const WAIT_DEFAULT_MS = 30 * 60_000
const WAIT_MAX_MS = 4 * 60 * 60_000
// The wait wakes on a change in the data directory; this is only the safety net
// for the rare case a filesystem event is missed.
const WAIT_RECHECK_MS = 2000

function short(row: Row): string {
  return row.id.slice(0, 8)
}

function progress(row: Row): string {
  if (row.steps.length === 0) return ''
  return `${row.steps.filter((step) => step.done).length}/${row.steps.length}`
}

function describe(row: Row): string {
  const parts = [short(row), row.text]
  const counter = progress(row)
  if (counter) parts.push(counter)
  else if (row.source) parts.push(row.source)
  if (row.waiter) parts.push(`(${row.waiter.label} väntar)`)
  return parts.join('  ')
}

function readStdin(): string[] {
  // Nothing is piped in when the CLI is used at a prompt; reading fd 0 there
  // would block until the user closed the stream by hand.
  if (process.stdin.isTTY) return []

  try {
    return readFileSync(0, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function linkFrom(parsed: ReturnType<typeof parse>): RowLink | undefined {
  const url = flag(parsed, 'link')
  if (url) return { kind: 'url', target: url }

  const file = flag(parsed, 'fil') ?? flag(parsed, 'file')
  if (file) return { kind: 'file', target: file }

  const command = flag(parsed, 'kommando') ?? flag(parsed, 'command')
  if (command) return { kind: 'command', target: command }

  return undefined
}

/** Steps keep the order they were written in, whichever flag introduced them. */
function stepsFrom(
  parsed: ReturnType<typeof parse>
): Array<{ text: string; expects: 'none' | 'text' }> {
  return parsed.ordered.map((entry) => ({
    text: entry.value,
    expects: entry.name === 'step' ? 'none' : 'text'
  }))
}

function formatOf(
  parsed: ReturnType<typeof parse>,
  fallback: 'markdown' | 'answers' = 'markdown'
): 'markdown' | 'json' | 'prompt' | 'answers' {
  const value = flag(parsed, 'format')
  if (value === 'json' || value === 'prompt' || value === 'answers' || value === 'markdown') {
    return value
  }
  return parsed.bare.has('json') ? 'json' : fallback
}

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

/**
 * Blocks until the row leaves the queue. It watches the data directory rather
 * than reading in a tight loop — over a wait of hours that is thousands of
 * pointless reads — and re-checks every couple of seconds in case an event is
 * missed.
 */
function untilComplete(
  store: InstanceType<typeof Store>,
  rowId: string,
  deadline: number
): Promise<Receipt | null> {
  return new Promise<Receipt | null>((resolve) => {
    let settled = false

    const finish = (receipt: Receipt | null): void => {
      if (settled) return
      settled = true
      watcher?.close()
      clearInterval(recheck)
      clearTimeout(timer)
      resolve(receipt)
    }

    const check = (): void => {
      // The watcher schedules its checks on a short delay, so one can still be
      // in flight after the wait is over and the database has been closed.
      if (settled) return

      const receipt = store.receiptForRow(rowId)
      if (receipt) finish(receipt)
    }

    let watcher: ReturnType<typeof watch> | undefined
    try {
      watcher = watch(dataDir(), () => setTimeout(check, 50))
    } catch {
      // No watcher available; the interval below carries the whole load.
    }

    const recheck = setInterval(check, WAIT_RECHECK_MS)
    const timer = setTimeout(() => finish(null), Math.max(0, deadline - Date.now()))

    check()
  })
}

/**
 * Registers a waiter, blocks, and prints the receipt. Interrupting removes the
 * waiter but never touches the row: a cancelled wait is not cancelled work.
 */
async function waitForRow(
  store: InstanceType<typeof Store>,
  row: Row,
  parsed: ReturnType<typeof parse>,
  timeoutValue: string | undefined
): Promise<void> {
  if (!readSettings().allowWaiting) {
    fail('listan wait: väntan är avstängd i inställningarna', 3)
  }

  const timeout = Math.min(duration(timeoutValue, WAIT_DEFAULT_MS), WAIT_MAX_MS)
  const label = flag(parsed, 'väntare') || flag(parsed, 'waiter') || 'En agent'
  const waiter = store.addWaiter(row.id, timeout, label)

  const release = (): void => {
    try {
      store.removeWaiter(waiter)
    } catch {
      // Shutting down; the waiter expires on its own either way.
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      release()
      process.exit(signal === 'SIGINT' ? 130 : 143)
    })
  }

  try {
    const receipt = await untilComplete(store, row.id, Date.now() + timeout)
    if (receipt) {
      process.stdout.write(`${render(receipt, formatOf(parsed, 'answers'))}
`)
      return
    }
  } finally {
    release()
  }

  fail(`listan wait: tiden gick ut, raden ${short(row)} är fortfarande öppen`, 2)
}

async function main(): Promise<void> {
  const parsed = parse(process.argv.slice(2))
  const json = parsed.bare.has('json')

  if (!parsed.command || parsed.command === 'help' || parsed.bare.has('help')) {
    process.stdout.write(`${USAGE}\n`)
    return
  }

  const store = new Store()
  const emit = (value: unknown, human: string): void => {
    process.stdout.write(json ? `${JSON.stringify(value)}\n` : human ? `${human}\n` : '')
  }

  switch (parsed.command) {
    case 'add': {
      const texts = parsed.positional.length > 0 ? parsed.positional : readStdin()
      if (texts.length === 0) fail('listan add: ingen text angiven')

      const shared = {
        tab: flag(parsed, 'tab'),
        source: flag(parsed, 'källa') ?? flag(parsed, 'source'),
        batch: flag(parsed, 'batch')
      }

      // A return target is checked before it is stored, so nothing downstream
      // has to trust a string an agent picked.
      const webhook = flag(parsed, 'webhook')
      if (webhook && !isAllowedWebhook(webhook, readSettings().webhookAllowlist)) {
        fail(`listan add: ${webhook} finns inte i tillåtlistan i inställningarna`)
      }

      // Steps, a brief and a link belong to a single row, so they only apply
      // when one row is being added. A batch from stdin is bare lines.
      const single = texts.length === 1
      const steps = stepsFrom(parsed)
      const added = texts.map((text) =>
        store.add({
          text,
          ...shared,
          link: single ? linkFrom(parsed) : undefined,
          body: single ? (flag(parsed, 'brief') ?? flag(parsed, 'body')) : undefined,
          context: single ? (flag(parsed, 'kontext') ?? flag(parsed, 'context')) : undefined,
          webhook: single ? webhook : undefined,
          steps: single && steps.length > 0 ? steps : undefined
        })
      )

      // --wait makes this one atomic call: nothing can finish the row in the
      // gap between creating it and waiting on it, because there is no gap.
      // The receipt is then the whole answer, so the row is not announced
      // separately — a machine reader gets one document, not two.
      const wait = flag(parsed, 'wait')
      if (wait !== undefined && single) {
        await waitForRow(store, added[0], parsed, wait)
        break
      }

      emit(added, added.map((row) => `+ ${describe(row)}`).join('\n'))
      break
    }

    case 'list': {
      // slug rather than ensureTab: listing an unknown tab should say nothing,
      // not quietly create it.
      const tab = flag(parsed, 'tab') ?? parsed.positional[0]
      const rows = store.rows(tab ? slug(tab) : undefined)

      if (json) {
        emit(rows, '')
        break
      }

      if (rows.length === 0) {
        process.stdout.write('Kön är tom.\n')
        break
      }

      const names = new Map(store.tabs().map((entry) => [entry.id, entry.name]))
      let current = ''
      for (const row of rows) {
        if (row.tab !== current) {
          if (current) process.stdout.write('\n')
          current = row.tab
          process.stdout.write(`${names.get(current) ?? current}\n`)
        }
        process.stdout.write(`  ${describe(row)}\n`)
      }
      break
    }

    case 'next': {
      const active = store.next()
      if (!active) {
        emit(null, 'Kön är tom.')
        break
      }

      const lines = [describe(active.row)]
      if (active.step) lines.push(`→ ${active.step.text}`)
      emit(active, lines.join('\n'))
      break
    }

    case 'check': {
      const target = parsed.positional[0] ? store.resolve(parsed.positional[0]) : store.next()?.row
      if (!target) fail('listan check: hittade ingen rad')

      const result = store.check(target.id)
      if (!result) fail('listan check: hittade ingen rad')

      if (result.complete) {
        const receipt = store.complete(result.row.id, 'completed')
        emit(receipt, `✓ ${result.row.text} — klar, kvitto ${receipt?.id.slice(0, 8)}`)
        break
      }

      const pending = result.row.steps.find((step) => !step.done)
      emit(
        { ...result, removed: false },
        `✓ ${progress(result.row)}${pending ? `  →  ${pending.text}` : ''}`
      )
      break
    }

    case 'rm': {
      const target = parsed.positional[0]
      if (!target) fail('listan rm: ange ett id')

      const row = store.resolve(target)
      if (!row) fail(`listan rm: hittade ingen rad för "${target}"`)

      const receipt = store.complete(row.id, 'cancelled')
      emit(receipt, `− ${row.text} — avbruten`)
      break
    }

    case 'requeue': {
      const target = parsed.positional[0]
      if (!target) fail('listan requeue: ange ett id')

      const row = store.resolve(target)
      if (!row) fail(`listan requeue: hittade ingen rad för "${target}"`)

      const moved = store.requeue(row.id, flag(parsed, 'tab'))
      emit(moved, `↓ ${row.text}`)
      break
    }

    case 'result': {
      const target = parsed.positional[0]
      if (!target) fail('listan result: ange ett id')

      const receipt = store.resolveReceipt(target)
      if (!receipt) fail(`listan result: inget kvitto för "${target}"`)

      process.stdout.write(`${render(receipt, formatOf(parsed))}\n`)
      break
    }

    case 'results': {
      const since = Number(flag(parsed, 'sedan') ?? flag(parsed, 'since') ?? 0)
      const receipts = store.receipts(Number.isFinite(since) ? since : 0)

      if (json) {
        emit(receipts, '')
        break
      }

      if (receipts.length === 0) {
        process.stdout.write('Inga kvitton.\n')
        break
      }

      const format = formatOf(parsed)
      process.stdout.write(
        `${receipts.map((receipt) => render(receipt, format)).join('\n\n---\n\n')}\n`
      )
      break
    }

    case 'wait': {
      const target = parsed.positional[0]
      if (!target) fail('listan wait: ange ett id')

      // A wait on a row that is already finished answers straight away rather
      // than blocking for nothing.
      const existing = store.resolveReceipt(target)
      if (existing) {
        process.stdout.write(`${render(existing, formatOf(parsed, 'answers'))}
`)
        break
      }

      const row = store.resolve(target)
      if (!row) fail(`listan wait: hittade ingen rad för "${target}"`)

      await waitForRow(store, row, parsed, flag(parsed, 'timeout') ?? flag(parsed, 'wait'))
      break
    }

    default:
      fail(`listan: okänt kommando "${parsed.command}"\n\n${USAGE}`)
  }

  store.close()
}

main()
