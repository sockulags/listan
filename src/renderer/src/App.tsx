import { useCallback, useEffect, useRef, useState } from 'react'
import type { Row } from '@shared/types'
import { useQueue } from './useQueue'
import {
  ChevronIcon,
  CheckIcon,
  OpenIcon,
  PlusIcon,
  PullRequestIcon,
  RunIcon,
  TickIcon
} from './components/icons'

/** How long a finished row stays undoable before it is actually deleted. */
const UNDO_MS = 6000

/** Room for the native window buttons Windows draws over the title bar. */
const CONTROLS_WIDTH = 140

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

const URL_PATTERN = /https?:\/\/\S+/

/** A pasted link becomes the row's link; whatever is left becomes its text. */
function parseInput(value: string): { text: string; link?: string } {
  const match = value.match(URL_PATTERN)
  if (!match) return { text: value }

  const rest = value.replace(match[0], '').trim()
  return { text: rest || match[0], link: match[0] }
}

/** Meta like `#34` and `1/3` lines up in a column; a word like `release-agent` does not. */
function isNumeric(value: string): boolean {
  return /\d/.test(value) && !/[a-zA-ZåäöÅÄÖ]/.test(value)
}

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useQueue()
  const [selectedTab, setSelectedTab] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, setPending] = useState<Row | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const topRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // A staged update installs on its own the next time the app quits; the line
  // at the bottom is only there for when you would rather have it now.
  useEffect(() => window.listan.onUpdateReady(setUpdateReady), [])

  // The window is as tall as the queue: chrome plus however much list there is,
  // clamped in the main process. Draining the queue shrinks the window.
  useEffect(() => {
    let frame = 0

    const measure = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const height =
          (topRef.current?.offsetHeight ?? 0) +
          (listRef.current?.offsetHeight ?? 0) +
          (bottomRef.current?.offsetHeight ?? 0)

        if (height > 0) window.listan.setHeight(height)
      })
    }

    const observer = new ResizeObserver(measure)
    for (const node of [topRef.current, listRef.current, bottomRef.current]) {
      if (node) observer.observe(node)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // Until a tab is picked, the first one is shown. Deriving it rather than
  // storing it keeps the two in sync when tabs appear from the CLI.
  const activeTab = selectedTab ?? snapshot.tabs[0]?.id ?? null
  const sortable = snapshot.tabs.find((tab) => tab.id === activeTab)?.ordered ?? false

  // A finished row disappears at once but is only deleted when the undo window
  // closes, so a mis-click is recoverable.
  const finish = useCallback(
    (row: Row) => {
      setPending(row)
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        setPending(null)
        setSnapshot(await window.listan.remove(row.id))
      }, UNDO_MS)
    },
    [setSnapshot]
  )

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

  async function submitDraft(event: React.FormEvent): Promise<void> {
    event.preventDefault()

    const value = draft.trim()
    if (!value) return

    const { text, link } = parseInput(value)
    setDraft('')
    setSnapshot(await window.listan.add(text, activeTab ?? undefined, link))
  }

  const visible = snapshot.rows.filter((row) => row.tab === activeTab && row.id !== pending?.id)

  // While a row is being dragged the list is rendered in the order it would
  // land in, so the drop is a confirmation of what you already see.
  const preview = ((): Row[] => {
    if (!dragId || !overId || dragId === overId) return visible

    const from = visible.findIndex((row) => row.id === dragId)
    const to = visible.findIndex((row) => row.id === overId)
    if (from === -1 || to === -1) return visible

    const next = [...visible]
    next.splice(to, 0, next.splice(from, 1)[0])
    return next
  })()

  async function drop(): Promise<void> {
    const ids = preview.map((row) => row.id)
    setDragId(null)
    setOverId(null)
    if (activeTab) setSnapshot(await window.listan.reorder(activeTab, ids))
  }

  // A run is only worth naming when it left more than one row behind.
  const runs = new Map<string, number>()
  for (const row of preview) {
    if (row.batch) runs.set(row.batch, (runs.get(row.batch) ?? 0) + 1)
  }
  const run = [...runs.entries()].find(([, count]) => count > 1)

  return (
    <div className="flex h-full flex-col bg-bg">
      <div ref={topRef}>
        <header
          className="flex items-center gap-3 px-4"
          style={{ ...DRAG, height: 40, paddingRight: CONTROLS_WIDTH }}
        >
          <span className="text-[13px] font-medium text-fg-subtle">listan</span>
          <span className="ml-auto whitespace-nowrap text-xs text-fg-subtle">Ctrl+Shift+K</span>
        </header>

        <nav className="flex gap-1.5 px-4 pb-3.5 pt-1">
          {snapshot.tabs.map((tab) => {
            const count = snapshot.rows.filter((row) => row.tab === tab.id).length
            const on = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                style={NO_DRAG}
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

        {run && (
          <div className="px-4 pb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-subtle">
              <RunIcon />
              Agentkörning · <span className="font-normal">{run[1]} rader</span>
            </span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div ref={listRef}>
          {preview.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-fg-subtle">
              Inget väntar på dina händer.
            </p>
          )}

          {preview.map((row) => {
            const hasSteps = row.steps.length > 0
            const open = hasSteps && expanded === row.id
            const done = row.steps.filter((step) => step.done).length

            const dragProps = sortable
              ? {
                  draggable: true,
                  onDragStart: () => setDragId(row.id),
                  onDragEnter: () => setOverId(row.id),
                  onDragOver: (event: React.DragEvent) => event.preventDefault(),
                  onDragEnd: () => {
                    setDragId(null)
                    setOverId(null)
                  },
                  onDrop: drop
                }
              : {}

            const dragging = dragId === row.id ? 'opacity-40' : ''

            if (!hasSteps) {
              return (
                <div
                  key={row.id}
                  {...dragProps}
                  className={`group flex items-center gap-3.5 border-t border-border px-4 py-3.5 text-[15px] transition-opacity duration-150 ${dragging}`}
                >
                  {/* The glyph says where the row came from; hovering turns that
                      same slot into the control that finishes it. */}
                  <span className="relative size-[18px] shrink-0">
                    <span className="absolute inset-0 text-fg-subtle group-focus-within:opacity-0 group-hover:opacity-0">
                      {row.link ? <PullRequestIcon /> : <RunIcon />}
                    </span>
                    <button
                      onClick={() => finish(row)}
                      aria-label="Markera klar"
                      className="absolute inset-0 text-fg-subtle opacity-0 transition-colors duration-150 hover:text-accent group-focus-within:opacity-100 group-hover:opacity-100"
                    >
                      <CheckIcon />
                    </button>
                  </span>
                  <button
                    onClick={() => row.link && window.listan.open(row.id)}
                    disabled={!row.link}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1 truncate">{row.text}</span>
                    {row.source && (
                      <span
                        className={`shrink-0 text-[13px] text-fg-subtle ${
                          isNumeric(row.source) ? 'tabular-nums' : ''
                        }`}
                      >
                        {row.source}
                      </span>
                    )}
                    {row.link && (
                      <span className="shrink-0 text-fg-subtle opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                        <OpenIcon />
                      </span>
                    )}
                  </button>
                </div>
              )
            }

            return (
              <div
                key={row.id}
                {...dragProps}
                className={`group mx-2 my-1.5 rounded-[10px] bg-accent-soft transition-opacity duration-150 ${dragging}`}
              >
                <div className="flex w-full items-center gap-3 px-3 py-3 text-[15px] text-accent-soft-fg">
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
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{row.text}</span>
                    <span className="shrink-0 text-[13px] tabular-nums text-accent">
                      {done}/{row.steps.length}
                    </span>
                    {row.link && (
                      <span className="shrink-0 text-accent opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                        <OpenIcon />
                      </span>
                    )}
                  </button>
                </div>

                {open && (
                  <div className="flex flex-col gap-0.5 pb-3 pl-[42px] pr-3">
                    {row.steps.map((step) => (
                      <label
                        key={step.id}
                        className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-accent-soft-fg"
                      >
                        <span className="relative flex size-[17px] shrink-0 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={step.done}
                            onChange={(event) => toggleStep(row, step.id, event.target.checked)}
                            className="peer size-[17px] cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-border-strong bg-surface transition-colors duration-150 checked:border-accent checked:bg-accent"
                          />
                          <span className="pointer-events-none absolute text-accent-fg opacity-0 peer-checked:opacity-100">
                            <TickIcon />
                          </span>
                        </span>
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
      </div>

      <div ref={bottomRef}>
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

        {updateReady && (
          <div className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-fg-muted">{updateReady} är hämtad</span>
            <button
              onClick={() => window.listan.installUpdate()}
              className="shrink-0 font-medium text-accent transition-opacity duration-150 hover:opacity-80"
            >
              Starta om
            </button>
          </div>
        )}

        <form
          onSubmit={submitDraft}
          className="flex items-center gap-2.5 border-t border-border px-4 py-2.5"
        >
          <span className="shrink-0 text-fg-subtle">
            <PlusIcon />
          </span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Lägg till"
            aria-label="Lägg till en rad"
            className="min-w-0 flex-1 bg-transparent py-1 text-[14.5px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </form>
      </div>
    </div>
  )
}
