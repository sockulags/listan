import { useQueue } from './useQueue'
import { ArrowIcon, CloseIcon } from './components/icons'

/**
 * The pinned overlay shows one row at a time: what you are on, the next step
 * that is still unchecked, and a single grey line for whatever is behind it.
 * It does not grow when the queue does.
 */
export default function Overlay(): React.JSX.Element {
  const [snapshot] = useQueue()

  const ordered = snapshot.tabs.find((tab) => tab.ordered)?.id ?? snapshot.tabs[0]?.id
  const rows = snapshot.rows.filter((row) => row.tab === ordered)
  const [active, ...rest] = rows
  const step = active?.steps.find((entry) => !entry.done)
  const done = active?.steps.filter((entry) => entry.done).length ?? 0

  const trailing = rest.slice(0, 2).map((row) => row.text)
  const overflow = rest.length - trailing.length

  return (
    <div
      className="flex h-full flex-col border border-border-strong bg-surface px-4 py-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {!active && <p className="m-auto text-sm text-fg-subtle">Inget väntar på dina händer.</p>}

      {active && (
        <>
          <div className="flex items-start gap-2.5">
            <button
              onClick={() => active.link && window.listan.open(active.id)}
              disabled={!active.link}
              className="min-w-0 flex-1 truncate text-left text-sm font-medium disabled:cursor-default"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {active.text}
            </button>
            {active.steps.length > 0 && (
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-fg-subtle">
                {done}/{active.steps.length}
              </span>
            )}
            <button
              onClick={() => window.listan.hideOverlay()}
              aria-label="Dölj"
              className="shrink-0 text-fg-subtle transition-colors duration-150 hover:text-fg"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <CloseIcon />
            </button>
          </div>

          {step && (
            <div className="mt-1.5 flex items-center gap-2 text-[13px] text-fg-muted">
              <span className="shrink-0 text-accent">
                <ArrowIcon />
              </span>
              <span className="min-w-0 truncate">{step.text}</span>
            </div>
          )}

          <div className="mt-auto truncate border-t border-border pt-2 text-xs text-fg-subtle">
            {trailing.length > 0
              ? [...trailing, overflow > 0 ? `+${overflow}` : null].filter(Boolean).join(' · ')
              : 'Inget mer i kön.'}
          </div>
        </>
      )}
    </div>
  )
}
