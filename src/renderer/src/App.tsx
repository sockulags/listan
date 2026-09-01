import { useCallback, useEffect, useRef, useState } from 'react'
import type { Row } from '@shared/types'
import { ChevronIcon, CheckIcon, OpenIcon, PullRequestIcon, RunIcon } from './components/icons'

interface Snapshot {
  tabs: { id: string; name: string; ordered: boolean }[]
  rows: Row[]
}

const EMPTY: Snapshot = { tabs: [], rows: [] }

/** How long a finished row stays undoable before it is actually deleted. */
const UNDO_MS = 6000

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [selectedTab, setSelectedTab] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, setPending] = useState<Row | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Until a tab is picked, the first one is shown. Deriving it rather than
  // storing it keeps the two in sync when tabs appear from the CLI.
  const activeTab = selectedTab ?? snapshot.tabs[0]?.id ?? null

  useEffect(() => {
    let alive = true

    const load = async (): Promise<void> => {
      const next = await window.listan.read()
      if (alive) setSnapshot(next)
    }

    const off = window.listan.onChanged(load)
    load()

    return () => {
      alive = false
      off()
    }
  }, [])

  // A finished row disappears at once but is only deleted when the undo window
  // closes, so a mis-click is recoverable.
  const finish = useCallback((row: Row) => {
    setPending(row)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setPending(null)
      setSnapshot(await window.listan.remove(row.id))
    }, UNDO_MS)
  }, [])

  const undo = useCallback(() => {
    clearTimeout(timer.current)
    setPending(null)
  }, [])

  async function toggleStep(row: Row, stepId: string, done: boolean): Promise<void> {
    const next = await window.listan.setStep(row.id, stepId, done)
    setSnapshot(next)

    const updated = next.rows.find((candidate) => candidate.id === row.id)
    if (done && updated && updated.steps.every((step) => step.done)) finish(updated)
  }

  const visible = snapshot.rows.filter((row) => row.tab === activeTab && row.id !== pending?.id)
  const batch = visible.find((row) => row.batch)?.batch

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="text-[13px] font-medium text-fg-subtle">listan</span>
      </header>

      <nav className="flex gap-1.5 px-4 pb-3.5">
        {snapshot.tabs.map((tab) => {
          const count = snapshot.rows.filter((row) => row.tab === tab.id).length
          const on = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`rounded-full px-3 py-1 text-[13.5px] transition-colors duration-150 ${
                on ? 'bg-accent-soft font-medium text-accent-soft-fg' : 'text-fg-muted'
              }`}
            >
              {tab.name}
              {count > 0 && (
                <span className={`ml-1.5 tabular-nums ${on ? 'opacity-70' : 'text-fg-subtle'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {batch && (
        <div className="px-4 pb-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-subtle">
            <RunIcon />
            Agentkörning <span className="font-normal tabular-nums opacity-80">{batch}</span>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-fg-subtle">
            Inget väntar på dina händer.
          </p>
        )}

        {visible.map((row) => {
          const hasSteps = row.steps.length > 0
          const open = hasSteps && expanded === row.id
          const done = row.steps.filter((step) => step.done).length

          if (!hasSteps) {
            return (
              <div
                key={row.id}
                className="group flex items-center gap-3.5 border-t border-border px-4 py-3.5 text-[15px]"
              >
                {/* The glyph says where the row came from; hovering turns that
                    same slot into the control that finishes it. */}
                <span className="relative size-[18px] shrink-0">
                  <span className="absolute inset-0 text-fg-subtle group-hover:opacity-0 group-focus-within:opacity-0">
                    {row.link ? <PullRequestIcon /> : <RunIcon />}
                  </span>
                  <button
                    onClick={() => finish(row)}
                    aria-label="Markera klar"
                    className="absolute inset-0 text-fg-subtle opacity-0 transition-colors duration-150 hover:text-accent group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <CheckIcon />
                  </button>
                </span>
                <button
                  onClick={() => row.link && window.listan.open(row.id)}
                  disabled={!row.link}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left disabled:cursor-default"
                >
                  <span className="min-w-0 flex-1 truncate">{row.text}</span>
                  {row.source && (
                    <span className="shrink-0 text-[13px] tabular-nums text-fg-subtle">
                      {row.source}
                    </span>
                  )}
                  {row.link && (
                    <span className="shrink-0 text-fg-subtle">
                      <OpenIcon />
                    </span>
                  )}
                </button>
              </div>
            )
          }

          return (
            <div key={row.id} className="border-t border-border bg-accent-soft">
              <div className="flex w-full items-center gap-3.5 px-4 py-3.5 text-[15px] text-accent-soft-fg">
                <button
                  onClick={() => setExpanded(open ? null : row.id)}
                  aria-expanded={open}
                  aria-label={open ? 'Fäll ihop' : 'Fäll ut'}
                  className={`shrink-0 text-accent transition-transform duration-200 ${
                    open ? '' : '-rotate-90'
                  }`}
                >
                  <ChevronIcon />
                </button>
                <button
                  onClick={() => row.link && window.listan.open(row.id)}
                  disabled={!row.link}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left disabled:cursor-default"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{row.text}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-accent">
                    {done}/{row.steps.length}
                  </span>
                  {row.link && (
                    <span className="shrink-0 text-accent">
                      <OpenIcon />
                    </span>
                  )}
                </button>
              </div>

              {open && (
                <div className="flex flex-col gap-0.5 pb-3.5 pl-[46px] pr-4">
                  {row.steps.map((step) => (
                    <label
                      key={step.id}
                      className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-accent-soft-fg"
                    >
                      <input
                        type="checkbox"
                        checked={step.done}
                        onChange={(event) => toggleStep(row, step.id, event.target.checked)}
                        className="size-4 shrink-0 accent-accent"
                      />
                      <span
                        className={`transition-opacity duration-200 ${
                          step.done ? 'line-through opacity-45' : ''
                        }`}
                      >
                        {step.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {pending && (
        <div className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3 text-sm">
          <span className="min-w-0 flex-1 truncate text-fg-muted">{pending.text}</span>
          <button
            onClick={undo}
            className="shrink-0 font-medium text-accent transition-opacity duration-150 hover:opacity-80"
          >
            Ångra
          </button>
        </div>
      )}
    </div>
  )
}
