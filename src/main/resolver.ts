import { execFile } from 'child_process'
import { promisify } from 'util'
import { Store } from '../core/store'
import { databasePath } from '../core/paths'
import { readSettings } from '../core/settings'

const run = promisify(execFile)

const FIRST_CHECK_MS = 15_000
const INTERVAL_MS = 5 * 60_000
const CALL_TIMEOUT_MS = 15_000

const PULL_REQUEST = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/

// Node does not apply PATHEXT when it looks a bare command up on Windows, so
// `gh` alone resolves to nothing and every check fails silently.
const GH = process.platform === 'win32' ? 'gh.exe' : 'gh'

interface PullRequest {
  state: 'OPEN' | 'MERGED' | 'CLOSED'
}

/**
 * Four rows out of five are "granska PR N", and most of them stop needing you
 * without anyone telling the queue. Rather than leave them to rot, the pull
 * request is checked now and then and the row closes itself when it is merged
 * or closed — as `auto-resolved`, never as if you had done the work.
 */
export function registerResolver(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let stopped = false

  const sweep = async (): Promise<void> => {
    if (stopped || !readSettings().resolveGithub) return

    const store = new Store(databasePath())

    try {
      const candidates = store
        .rows()
        .filter((row) => row.link?.kind === 'url' && PULL_REQUEST.test(row.link.target))

      for (const row of candidates) {
        if (stopped) break

        const state = await pullRequestState(row.link!.target)
        if (state === 'OPEN' || state === null) continue

        store.complete(
          row.id,
          'auto-resolved',
          state === 'MERGED' ? 'PR mergad' : 'PR stängd utan merge'
        )
      }
    } finally {
      store.close()
    }
  }

  timer = setTimeout(() => {
    sweep()
    interval = setInterval(sweep, INTERVAL_MS)
  }, FIRST_CHECK_MS)

  return () => {
    stopped = true
    clearTimeout(timer)
    clearInterval(interval)
    timer = undefined
    interval = undefined
  }
}

/**
 * Uses the gh CLI rather than the API so it rides on the login you already
 * have. Anything that goes wrong — gh missing, offline, no access to the repo —
 * means "leave the row alone", never "close it".
 */
async function pullRequestState(url: string): Promise<PullRequest['state'] | null> {
  try {
    const { stdout } = await run(GH, ['pr', 'view', url, '--json', 'state'], {
      timeout: CALL_TIMEOUT_MS,
      windowsHide: true
    })

    const parsed = JSON.parse(stdout) as Partial<PullRequest>
    return parsed.state === 'MERGED' || parsed.state === 'CLOSED' || parsed.state === 'OPEN'
      ? parsed.state
      : null
  } catch (error) {
    // A resolver that silently never resolves anything is worse than a noisy
    // one; this line is the only place the reason becomes visible.
    console.warn(`[resolver] kunde inte läsa ${url}`, error)
    return null
  }
}
