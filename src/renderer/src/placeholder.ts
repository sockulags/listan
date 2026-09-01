import type { Row, Tab } from '@shared/types'

/**
 * Stand-in data so the window renders before the store exists. Everything here
 * is replaced by a read from the queue; the shapes are the real ones.
 */
export const tabs: Tab[] = [
  { id: 'prio', name: 'Prio', ordered: true },
  { id: 'jobb', name: 'Jobb', ordered: false },
  { id: 'privat', name: 'Privat', ordered: false }
]

export const rows: Row[] = [
  {
    id: '1',
    tab: 'prio',
    position: 0,
    text: 'Granska PR 34 — design-pilot',
    link: { kind: 'url', target: 'https://github.com/sockulags/design-pilot/pull/34' },
    source: '#34',
    batch: '4f2a',
    steps: []
  },
  {
    id: '2',
    tab: 'prio',
    position: 1,
    text: 'Verifiera auth-flödet — smask',
    link: { kind: 'url', target: 'https://github.com/sockulags/smask/pull/57' },
    batch: '4f2a',
    steps: [
      { id: '2a', text: 'kör smoke-testet lokalt', done: false },
      { id: '2b', text: 'kolla att session inte läcker', done: false },
      { id: '2c', text: 'merga', done: false }
    ]
  },
  {
    id: '3',
    tab: 'prio',
    position: 2,
    text: 'Granska PR 12 — clomp',
    link: { kind: 'url', target: 'https://github.com/sockulags/clomp/pull/12' },
    source: '#12',
    batch: '4f2a',
    steps: []
  },
  {
    id: '4',
    tab: 'prio',
    position: 3,
    text: 'Granska PR 8 — referat',
    link: { kind: 'url', target: 'https://github.com/sockulags/referat/pull/8' },
    source: '#8',
    batch: '4f2a',
    steps: []
  },
  {
    id: '5',
    tab: 'prio',
    position: 4,
    text: 'Boka om onsdagsavstämningen',
    source: 'referat',
    steps: []
  }
]
