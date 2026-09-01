import { describe, expect, it } from 'vitest'
import type { Receipt } from '../shared/types'
import { render } from './receipt'

const RECEIPT: Receipt = {
  id: 'r1',
  rowId: 'q1',
  reason: 'completed',
  createdAt: Date.UTC(2026, 8, 2, 12, 32),
  text: 'Verifiera auth-flödet',
  link: { kind: 'url', target: 'https://example.test/pull/57' },
  context: 'smask, branch fix/auth',
  note: 'mobilvyn ser trång ut',
  steps: [
    { text: 'kör smoke-testet lokalt', done: true, answer: 'in- och utloggning fungerar' },
    { text: 'kolla att session inte läcker', done: true },
    { text: 'merga', done: false }
  ]
}

describe('markdown', () => {
  it('shows every step with its answer and says why the row went', () => {
    const out = render(RECEIPT, 'markdown')

    expect(out).toContain('## Verifiera auth-flödet')
    expect(out).toContain('- [x] kör smoke-testet lokalt')
    expect(out).toContain('  - Svar: in- och utloggning fungerar')
    expect(out).toContain('- [ ] merga')
    expect(out).toContain('**Notering:** mobilvyn ser trång ut')
    expect(out).toContain('**Utfall:** Du gjorde arbetet.')
  })

  it('names a cancellation as a cancellation', () => {
    expect(render({ ...RECEIPT, reason: 'cancelled' }, 'markdown')).toContain(
      'utan att göra arbetet'
    )
  })
})

describe('answers', () => {
  it('leaves out the framing a live thread already has', () => {
    const out = render(RECEIPT, 'answers')

    expect(out).toContain('kör smoke-testet lokalt')
    expect(out).toContain('Notering: mobilvyn ser trång ut')
    expect(out).not.toContain('Länk:')
    expect(out).not.toContain('tidigare agentsession')
  })
})

describe('prompt', () => {
  it('carries the context a new thread never had', () => {
    const out = render(RECEIPT, 'prompt')

    expect(out).toContain('tidigare agentsession som inte finns kvar')
    expect(out).toContain('**Länk:** https://example.test/pull/57')
    expect(out).toContain('**Sammanhang:** smask, branch fix/auth')
    expect(out).toContain('Fortsätt härifrån')
  })
})

describe('json', () => {
  it('round-trips the receipt unchanged', () => {
    expect(JSON.parse(render(RECEIPT, 'json'))).toEqual(RECEIPT)
  })
})
