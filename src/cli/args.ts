export interface Parsed {
  command: string
  positional: string[]
  flags: Record<string, string[]>
  /** Repeatable flags in the order they were given, so steps keep their order. */
  ordered: Array<{ name: string; value: string }>
  bare: Set<string>
}

/** Flags that may be given more than once and keep every value. */
const REPEATABLE = new Set(['step', 'fråga', 'fraga'])

/** Flags that take no value. */
const BARE = new Set(['json', 'help'])

/**
 * A deliberately small parser. The CLI is called by agents, so the surface has
 * to stay predictable rather than clever: `--flag value`, `--flag=value`, and
 * bare `--json`. Anything after `--` is positional.
 */
export function parse(argv: string[]): Parsed {
  const parsed: Parsed = {
    command: '',
    positional: [],
    flags: {},
    ordered: [],
    bare: new Set()
  }
  let literal = false

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]

    if (literal || !token.startsWith('--')) {
      if (!parsed.command && !literal) parsed.command = token
      else parsed.positional.push(token)
      continue
    }

    if (token === '--') {
      literal = true
      continue
    }

    const [rawName, inlineValue] = splitOnce(token.slice(2))
    const name = rawName.toLowerCase()

    if (BARE.has(name)) {
      parsed.bare.add(name)
      continue
    }

    const value = inlineValue ?? argv[++index]
    if (value === undefined) continue

    if (REPEATABLE.has(name)) {
      ;(parsed.flags[name] ??= []).push(value)
      parsed.ordered.push({ name, value })
    } else {
      parsed.flags[name] = [value]
    }
  }

  return parsed
}

export function flag(parsed: Parsed, name: string): string | undefined {
  return parsed.flags[name]?.[0]
}

export function flags(parsed: Parsed, name: string): string[] {
  return parsed.flags[name] ?? []
}

/**
 * Durations as an agent would write them: `30s`, `45m`, `2h`, or a bare number
 * of seconds. Anything unparseable falls back to the default rather than
 * throwing.
 */
export function duration(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs

  const match = value.trim().match(/^(\d+)\s*(s|m|h)?$/i)
  if (!match) return fallbackMs

  const amount = Number(match[1])
  const unit = match[2]?.toLowerCase()

  if (unit === 'h') return amount * 60 * 60_000
  if (unit === 'm') return amount * 60_000
  return amount * 1000
}

function splitOnce(token: string): [string, string | undefined] {
  const at = token.indexOf('=')
  return at === -1 ? [token, undefined] : [token.slice(0, at), token.slice(at + 1)]
}
