import { describe, expect, it } from 'vitest'
import { appendDir, containsDir, splitPath } from './pathlist'

const BIN = 'C:\\Users\\lucas\\AppData\\Roaming\\listan\\bin'

describe('splitPath', () => {
  it('drops the empty entries a hand-edited PATH tends to collect', () => {
    expect(splitPath('C:\\a;;C:\\b; ;C:\\c')).toEqual(['C:\\a', 'C:\\b', 'C:\\c'])
  })

  it('is empty for an empty PATH', () => {
    expect(splitPath('')).toEqual([])
  })
})

describe('containsDir', () => {
  it('finds the directory whatever the case', () => {
    expect(containsDir(`C:\\other;${BIN.toUpperCase()}`, BIN)).toBe(true)
  })

  it('ignores a trailing separator on either side', () => {
    expect(containsDir(`C:\\other;${BIN}\\`, BIN)).toBe(true)
    expect(containsDir(`C:\\other;${BIN}`, `${BIN}\\`)).toBe(true)
  })

  it('sees through quotes', () => {
    expect(containsDir(`C:\\other;"${BIN}"`, BIN)).toBe(true)
  })

  it('does not match a directory that merely starts the same', () => {
    expect(containsDir(`${BIN}-gammal`, BIN)).toBe(false)
  })

  it('is false for a PATH without it', () => {
    expect(containsDir('C:\\other;C:\\more', BIN)).toBe(false)
  })
})

describe('appendDir', () => {
  it('adds the directory last', () => {
    expect(appendDir('C:\\other', BIN)).toBe(`C:\\other;${BIN}`)
  })

  it('leaves a PATH that already has it untouched', () => {
    const existing = `C:\\other;${BIN}`
    expect(appendDir(existing, BIN)).toBe(existing)
  })

  it('cleans up empty entries while it is there', () => {
    expect(appendDir('C:\\other;;', BIN)).toBe(`C:\\other;${BIN}`)
  })

  it('handles an empty PATH', () => {
    expect(appendDir('', BIN)).toBe(BIN)
  })
})
