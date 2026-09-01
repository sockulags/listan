import { describe, expect, it } from 'vitest'
import { Store, slug } from './store'

function store(): Store {
  return new Store(':memory:')
}

describe('slug', () => {
  it('folds case and diacritics into a stable tab id', () => {
    expect(slug('Övrigt')).toBe('ovrigt')
    expect(slug('Jobb')).toBe(slug('jobb'))
    expect(slug('Nästa vecka')).toBe('nasta-vecka')
  })
})

describe('tabs', () => {
  it('starts with prio as the only ordered tab', () => {
    const tabs = store().tabs()
    expect(tabs.map((tab) => tab.id)).toEqual(['prio', 'ovrigt'])
    expect(tabs.filter((tab) => tab.ordered).map((tab) => tab.id)).toEqual(['prio'])
  })

  it('creates unknown tabs as unordered piles', () => {
    const s = store()
    s.add({ text: 'Ringa leverantören', tab: 'Jobb' })
    expect(s.tabs().find((tab) => tab.id === 'jobb')).toEqual({
      id: 'jobb',
      name: 'Jobb',
      ordered: false
    })
  })
})

describe('add', () => {
  it('puts a row with steps in the ordered tab by default', () => {
    const s = store()
    const row = s.add({
      text: 'Verifiera auth-flödet',
      link: { kind: 'url', target: 'https://example.test/pull/57' },
      steps: ['kör smoke-testet lokalt', 'kolla att session inte läcker', 'merga']
    })

    expect(row.tab).toBe('prio')
    expect(row.steps.map((step) => step.text)).toEqual([
      'kör smoke-testet lokalt',
      'kolla att session inte läcker',
      'merga'
    ])
    expect(row.steps.every((step) => !step.done)).toBe(true)
  })

  it('appends rows in the order they arrive', () => {
    const s = store()
    s.add({ text: 'Granska PR 34' })
    s.add({ text: 'Granska PR 12' })
    expect(s.rows('prio').map((row) => row.text)).toEqual(['Granska PR 34', 'Granska PR 12'])
  })

  it('updates the existing row when the same link comes back', () => {
    const s = store()
    const link = { kind: 'url' as const, target: 'https://example.test/pull/34' }
    s.add({ text: 'Granska PR 34', link })
    s.add({ text: 'Granska PR 34 — omtag', link, steps: ['kör om testerna'] })

    const rows = s.rows('prio')
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('Granska PR 34 — omtag')
    expect(rows[0].steps.map((step) => step.text)).toEqual(['kör om testerna'])
  })

  it('keeps existing steps when a repeat carries none', () => {
    const s = store()
    const link = { kind: 'url' as const, target: 'https://example.test/pull/8' }
    s.add({ text: 'Granska PR 8', link, steps: ['läs diffen'] })
    s.add({ text: 'Granska PR 8', link })

    expect(s.rows('prio')[0].steps.map((step) => step.text)).toEqual(['läs diffen'])
  })

  it('treats rows without a link as distinct', () => {
    const s = store()
    s.add({ text: 'Boka om avstämningen' })
    s.add({ text: 'Boka om avstämningen' })
    expect(s.rows('prio')).toHaveLength(2)
  })
})

describe('next', () => {
  it('answers with the active row and its next unchecked step', () => {
    const s = store()
    s.add({ text: 'Granska PR 34' })
    s.add({ text: 'Verifiera auth-flödet', steps: ['kör smoke-testet', 'merga'] })

    const first = s.next()
    expect(first?.row.text).toBe('Granska PR 34')
    expect(first?.step).toBeNull()
  })

  it('walks the steps of the active row as they are checked', () => {
    const s = store()
    const row = s.add({ text: 'Verifiera auth-flödet', steps: ['kör smoke-testet', 'merga'] })

    expect(s.next()?.step?.text).toBe('kör smoke-testet')
    s.check(row.id)
    expect(s.next()?.step?.text).toBe('merga')
  })

  it('is null on an empty queue', () => {
    expect(store().next()).toBeNull()
  })

  it('ignores rows parked in unordered piles', () => {
    const s = store()
    s.add({ text: 'Läsa på om NIS2', tab: 'Övrigt' })
    expect(s.next()).toBeNull()
  })
})

describe('check', () => {
  it('reports completion only once the last step is checked', () => {
    const s = store()
    const row = s.add({ text: 'Verifiera auth-flödet', steps: ['ett', 'två'] })

    expect(s.check(row.id)?.complete).toBe(false)
    expect(s.check(row.id)?.complete).toBe(true)
  })

  it('treats a row without steps as complete straight away', () => {
    const s = store()
    const row = s.add({ text: 'Granska PR 34' })
    expect(s.check(row.id)?.complete).toBe(true)
  })

  it('leaves removal to the caller so an undo can be offered', () => {
    const s = store()
    const row = s.add({ text: 'Granska PR 34' })
    s.check(row.id)
    expect(s.row(row.id)).not.toBeNull()
  })
})

describe('reorder', () => {
  it('rewrites the order of a tab from a list of ids', () => {
    const s = store()
    const a = s.add({ text: 'a' })
    const b = s.add({ text: 'b' })
    const c = s.add({ text: 'c' })

    s.reorder('prio', [c.id, a.id, b.id])
    expect(s.rows('prio').map((row) => row.text)).toEqual(['c', 'a', 'b'])
  })

  it('keeps rows the caller left out, after the ones it named', () => {
    const s = store()
    const a = s.add({ text: 'a' })
    s.add({ text: 'b' })
    const c = s.add({ text: 'c' })

    s.reorder('prio', [c.id, a.id])
    expect(s.rows('prio').map((row) => row.text)).toEqual(['c', 'a', 'b'])
  })

  it('ignores ids that are not in the tab', () => {
    const s = store()
    const a = s.add({ text: 'a' })
    const b = s.add({ text: 'b' })

    s.reorder('prio', [b.id, 'finns-inte', a.id])
    expect(s.rows('prio').map((row) => row.text)).toEqual(['b', 'a'])
  })
})

describe('resolve', () => {
  it('finds a row by an id prefix', () => {
    const s = store()
    const row = s.add({ text: 'Granska PR 34' })
    expect(s.resolve(row.id.slice(0, 8))?.id).toBe(row.id)
  })

  it('refuses a prefix that matches nothing', () => {
    const s = store()
    s.add({ text: 'Granska PR 34' })
    expect(s.resolve('zzzzzzzz')).toBeNull()
  })
})

describe('remove', () => {
  it('deletes the row and its steps', () => {
    const s = store()
    const row = s.add({ text: 'Verifiera auth-flödet', steps: ['ett'] })

    expect(s.remove(row.id)).toBe(true)
    expect(s.row(row.id)).toBeNull()
    expect(s.remove(row.id)).toBe(false)
  })
})

describe('requeue', () => {
  it('sends a row to the back of its own tab', () => {
    const s = store()
    const first = s.add({ text: 'Granska PR 34' })
    s.add({ text: 'Granska PR 12' })

    s.requeue(first.id)
    expect(s.rows('prio').map((row) => row.text)).toEqual(['Granska PR 12', 'Granska PR 34'])
  })

  it('moves a row to another tab', () => {
    const s = store()
    const row = s.add({ text: 'Läsa på om NIS2' })

    expect(s.requeue(row.id, 'Övrigt')?.tab).toBe('ovrigt')
    expect(s.rows('prio')).toHaveLength(0)
  })

  it('is null for a row that is already gone', () => {
    expect(store().requeue('finns-inte')).toBeNull()
  })
})
