/**
 * A return target is a string an agent hands us, and one day something will
 * POST to it. Accepting it verbatim would let a confused or compromised agent
 * point your receipts — which carry your notes about internal work — anywhere
 * it liked. Targets are therefore matched against a list you keep yourself.
 */
export function isAllowedWebhook(target: string, allowlist: string[]): boolean {
  const url = parse(target)
  if (!url) return false

  return allowlist.some((entry) => {
    const allowed = parse(entry)
    if (!allowed) return false
    if (allowed.origin !== url.origin) return false

    // A trailing slash on the allowed path is what separates "this endpoint"
    // from "anything under this prefix"; both are useful, neither should match
    // a sibling path that merely starts with the same characters.
    const base = allowed.pathname.replace(/\/+$/, '')
    return url.pathname === base || url.pathname.startsWith(`${base}/`)
  })
}

/** Only https survives. http would put the receipt on the wire in clear text. */
function parse(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
