import { useState } from 'react'
import type { Row } from '@shared/types'
import { rows as placeholderRows, tabs } from './placeholder'
import { PullRequestIcon, RunIcon, OpenIcon, ChevronIcon } from './components/icons'

export default function App(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(placeholderRows)
  const [activeTab, setActiveTab] = useState('prio')
  const [expanded, setExpanded] = useState<string | null>('2')

  const visible = rows.filter((row) => row.tab === activeTab)
  const batch = visible.find((row) => row.batch)?.batch

  function toggleStep(rowId: string, stepId: string): void {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              steps: row.steps.map((step) =>
                step.id === stepId ? { ...step, done: !step.done } : step
              )
            }
          : row
      )
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="text-[13px] font-medium text-fg-subtle">listan</span>
        <span className="ml-auto text-xs tabular-nums text-fg-subtle">⌘⇧K</span>
      </header>

      <nav className="flex gap-1.5 px-4 pb-3.5">
        {tabs.map((tab) => {
          const count = rows.filter((row) => row.tab === tab.id).length
          const on = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
        {visible.map((row) => {
          const hasSteps = row.steps.length > 0
          const open = hasSteps && expanded === row.id
          const done = row.steps.filter((step) => step.done).length

          if (!hasSteps) {
            return (
              <div
                key={row.id}
                className="flex items-center gap-3.5 border-t border-border px-4 py-3.5 text-[15px]"
              >
                <span className="shrink-0 text-fg-subtle">
                  {row.link ? <PullRequestIcon /> : <RunIcon />}
                </span>
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
              </div>
            )
          }

          return (
            <div key={row.id} className="border-t border-border bg-accent-soft">
              <button
                onClick={() => setExpanded(open ? null : row.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[15px] text-accent-soft-fg"
              >
                <span
                  className={`shrink-0 text-accent transition-transform duration-200 ${
                    open ? '' : '-rotate-90'
                  }`}
                >
                  <ChevronIcon />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{row.text}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-accent">
                  {done}/{row.steps.length}
                </span>
                <span className="shrink-0 text-accent">
                  <OpenIcon />
                </span>
              </button>

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
                        onChange={() => toggleStep(row.id, step.id)}
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
    </div>
  )
}
