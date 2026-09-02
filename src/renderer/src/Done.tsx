import { useEffect, useState } from 'react'
import type { Reason, Receipt } from '@shared/types'
import { CopyIcon, OpenIcon } from './components/icons'

export type Period = 'idag' | 'vecka' | 'allt'

/** The retention window: nothing older than this exists to show. */
const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'idag', label: 'Idag' },
  { id: 'vecka', label: '7 dagar' },
  { id: 'allt', label: 'Allt' }
]

/** Only `completed` is work you actually did; the rest need saying out loud. */
const REASONS: Record<Reason, string | null> = {
  completed: null,
  'auto-resolved': 'löste sig själv',
  cancelled: 'avbruten',
  superseded: 'ersatt'
}

const TIME = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

function startOf(period: Period): number {
  const now = new Date()

  if (period === 'idag') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }
  if (period === 'vecka') return now.getTime() - 7 * 24 * 60 * 60 * 1000
  return 0
}

function dayLabel(at: number): string {
  const date = new Date(at)
  const today = new Date()
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  if (at >= midnight) return 'Idag'
  if (at >= midnight - 24 * 60 * 60 * 1000) return 'Igår'
  return DAY.format(date)
}

/**
 * What left the queue, newest first. This is not the queue growing a history —
 * the receipts already existed and expire on their own; they were simply only
 * reachable from the command line until now.
 */
export default function Done({
  period,
  onPeriod
}: {
  period: Period
  onPeriod: (next: Period) => void
}): React.JSX.Element {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const load = async (): Promise<void> => {
      const next = await window.listan.receipts(startOf(period))
      if (alive) setReceipts(next)
    }

    const off = window.listan.onChanged(load)
    load()

    return () => {
      alive = false
      off()
    }
  }, [period])

  async function copy(receipt: Receipt): Promise<void> {
    await window.listan.copy(await window.listan.renderReceipt(receipt, 'prompt'))
    setCopied(receipt.id)
    setTimeout(() => setCopied(null), 1800)
  }

  // The day heading is worked out up front rather than by mutating a variable
  // while the list renders.
  const items = receipts.map((receipt, index) => {
    const day = dayLabel(receipt.createdAt)
    const previous = index > 0 ? dayLabel(receipts[index - 1].createdAt) : null
    return { receipt, heading: day === previous ? null : day }
  })

  return (
    <div>
      <div className="flex gap-1.5 px-4 pb-2">
        {PERIODS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onPeriod(entry.id)}
            className={`rounded-full px-2.5 py-0.5 text-xs transition-colors duration-150 ${
              period === entry.id
                ? 'bg-surface-2 font-medium text-fg-muted'
                : 'text-fg-subtle hover:text-fg-muted'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {receipts.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-fg-subtle">
          {period === 'idag' ? 'Inget avklarat idag än.' : 'Inget här.'}
        </p>
      )}

      {items.map(({ receipt, heading }) => {
        const note = REASONS[receipt.reason]
        const answers = receipt.steps.filter((step) => step.answer)

        return (
          <div key={receipt.id}>
            {heading && period !== 'idag' && (
              <p className="px-4 pb-1 pt-3 text-xs font-medium text-fg-subtle">{heading}</p>
            )}

            <div className="group flex items-start gap-3 border-t border-border px-4 py-3">
              <span className="w-9 shrink-0 pt-px text-[12.5px] tabular-nums text-fg-subtle">
                {TIME.format(new Date(receipt.createdAt))}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-[14.5px] ${
                      receipt.reason === 'completed' ? 'text-fg' : 'text-fg-muted'
                    }`}
                  >
                    {receipt.text}
                  </span>
                  {note && <span className="shrink-0 text-xs text-fg-subtle">{note}</span>}
                </div>

                {receipt.note && (
                  <span className="truncate text-[13px] text-fg-muted">{receipt.note}</span>
                )}

                {answers.map((step, index) => (
                  <span key={index} className="truncate text-[13px] text-fg-muted">
                    {step.text}: {step.answer}
                  </span>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-2 pt-px opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                <button
                  onClick={() => copy(receipt)}
                  aria-label="Kopiera återlämning"
                  title="Kopiera återlämning"
                  className="text-fg-subtle transition-colors duration-150 hover:text-accent"
                >
                  <CopyIcon />
                </button>
                {receipt.link && (
                  <button
                    onClick={() => window.listan.openLink(receipt.link!.target)}
                    aria-label="Öppna länken"
                    className="text-fg-subtle transition-colors duration-150 hover:text-accent"
                  >
                    <OpenIcon />
                  </button>
                )}
              </div>
            </div>

            {copied === receipt.id && (
              <p className="px-4 pb-2 text-xs text-accent">Återlämningen är kopierad.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
