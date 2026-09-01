import { describe, expect, it } from 'vitest'
import { isAllowedWebhook } from './webhook'

const ALLOW = ['https://hooks.example.test/listan', 'https://intern.example.test/api/']

describe('isAllowedWebhook', () => {
  it('accepts the exact endpoint and anything under it', () => {
    expect(isAllowedWebhook('https://hooks.example.test/listan', ALLOW)).toBe(true)
    expect(isAllowedWebhook('https://hooks.example.test/listan/kvitto', ALLOW)).toBe(true)
    expect(isAllowedWebhook('https://intern.example.test/api/receipts', ALLOW)).toBe(true)
  })

  it('refuses another host, however similar', () => {
    expect(isAllowedWebhook('https://hooks.example.test.evil.test/listan', ALLOW)).toBe(false)
    expect(isAllowedWebhook('https://other.example.test/listan', ALLOW)).toBe(false)
  })

  it('refuses a sibling path that merely shares a prefix', () => {
    expect(isAllowedWebhook('https://hooks.example.test/listan-annat', ALLOW)).toBe(false)
  })

  it('refuses anything that is not https', () => {
    expect(isAllowedWebhook('http://hooks.example.test/listan', ALLOW)).toBe(false)
    expect(isAllowedWebhook('file:///etc/passwd', ALLOW)).toBe(false)
    expect(isAllowedWebhook('javascript:alert(1)', ALLOW)).toBe(false)
  })

  it('refuses everything when the list is empty', () => {
    expect(isAllowedWebhook('https://hooks.example.test/listan', [])).toBe(false)
  })

  it('refuses nonsense rather than throwing', () => {
    expect(isAllowedWebhook('inte en url', ALLOW)).toBe(false)
    expect(isAllowedWebhook('', ALLOW)).toBe(false)
  })
})
