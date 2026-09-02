import { describe, expect, it } from 'vitest'
import { duration, flag, flags, parse } from './args'

describe('ordered', () => {
  it('keeps steps and questions in the order they were written', () => {
    const parsed = parse(['add', 'x', '--step', 'ett', '--fråga', 'vad hände', '--step', 'tre'])

    expect(parsed.ordered).toEqual([
      { name: 'step', value: 'ett' },
      { name: 'fråga', value: 'vad hände' },
      { name: 'step', value: 'tre' }
    ])
  })
})

describe('duration', () => {
  it('reads minutes, seconds and bare numbers', () => {
    expect(duration('10m', 0)).toBe(600_000)
    expect(duration('30s', 0)).toBe(30_000)
    expect(duration('45', 0)).toBe(45_000)
  })

  it('falls back rather than throwing on nonsense', () => {
    expect(duration('snart', 1234)).toBe(1234)
    expect(duration(undefined, 1234)).toBe(1234)
  })
})

describe('parse', () => {
  it('reads the command and its text', () => {
    const parsed = parse(['add', 'Verifiera auth-flödet'])
    expect(parsed.command).toBe('add')
    expect(parsed.positional).toEqual(['Verifiera auth-flödet'])
  })

  it('collects repeated steps in order', () => {
    const parsed = parse(['add', 'x', '--step', 'ett', '--step', 'två', '--step', 'tre'])
    expect(flags(parsed, 'step')).toEqual(['ett', 'två', 'tre'])
  })

  it('accepts both --flag value and --flag=value', () => {
    expect(flag(parse(['add', 'x', '--tab', 'Jobb']), 'tab')).toBe('Jobb')
    expect(flag(parse(['add', 'x', '--tab=Jobb']), 'tab')).toBe('Jobb')
  })

  it('keeps the last value of a flag that is not repeatable', () => {
    expect(flag(parse(['add', 'x', '--tab', 'Jobb', '--tab', 'Privat']), 'tab')).toBe('Privat')
  })

  it('treats --json as a bare flag rather than swallowing the next token', () => {
    const parsed = parse(['list', '--json', 'prio'])
    expect(parsed.bare.has('json')).toBe(true)
    expect(parsed.positional).toEqual(['prio'])
  })

  it('stops interpreting flags after --', () => {
    const parsed = parse(['add', '--', '--inte-en-flagga'])
    expect(parsed.positional).toEqual(['--inte-en-flagga'])
  })

  it('reads a trailing flag with no value as present but empty', () => {
    expect(flag(parse(['add', 'x', '--tab']), 'tab')).toBe('')
    expect(flag(parse(['add', 'x']), 'tab')).toBeUndefined()
  })
})

describe('flags that take a value', () => {
  it('does not swallow the flag that follows a bare one', () => {
    const parsed = parse(['add', 'x', '--wait', '--json'])

    expect(flag(parsed, 'wait')).toBe('')
    expect(parsed.bare.has('json')).toBe(true)
  })

  it('falls back to the default duration for a bare --wait', () => {
    expect(duration(flag(parse(['add', 'x', '--wait', '--json']), 'wait'), 42)).toBe(42)
  })

  it('still reads a value that is there', () => {
    expect(flag(parse(['add', 'x', '--wait', '30m']), 'wait')).toBe('30m')
  })
})
