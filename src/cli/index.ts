#!/usr/bin/env node
import { readFileSync } from 'fs'
import type { Row, RowLink } from '../shared/types'
import { flag, flags, parse } from './args'

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

const USAGE = `listan — kön för de manuella stegen dina agenter lämnar efter sig

  listan add <text> [--tab T] [--link URL] [--fil SÖKVÄG] [--kommando K]
                    [--step S ...] [--källa K] [--batch B]
  listan add                     läser en rad per rad från stdin
  listan list [--tab T]
  listan next                    aktiv rad plus nästa obockade steg
  listan check [id]              bockar nästa steg, utan id på aktiva raden
  listan rm <id>
  listan requeue <id> [--tab T]  skickar raden sist i sin flik

  --json på valfritt kommando ger maskinläsbar utdata.
  Id:n får förkortas så länge prefixet är unikt.`

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

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function main(): void {
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

      // Steps and a link belong to a single row, so they only apply when one
      // row is being added. A batch from stdin is a list of bare lines.
      const single = texts.length === 1
      const added = texts.map((text) =>
        store.add({
          text,
          ...shared,
          link: single ? linkFrom(parsed) : undefined,
          steps: single ? flags(parsed, 'step') : undefined
        })
      )

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
        store.remove(result.row.id)
        emit({ ...result, removed: true }, `✓ ${result.row.text} — klar och borttagen`)
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

      store.remove(row.id)
      emit({ removed: row }, `− ${row.text}`)
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

    default:
      fail(`listan: okänt kommando "${parsed.command}"\n\n${USAGE}`)
  }

  store.close()
}

main()
