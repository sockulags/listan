import { describe, expect, it } from 'vitest'
import { flag, flags, parse } from './args'

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

  it('ignores a trailing flag with no value', () => {
    expect(flag(parse(['add', 'x', '--tab']), 'tab')).toBeUndefined()
  })
})
