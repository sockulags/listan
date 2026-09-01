import { useCallback, useEffect, useState } from 'react'
import type { Receipt, Row } from '@shared/types'
import Markdown from './components/Markdown'
import { OpenIcon, TickIcon } from './components/icons'

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

/**
 * One row, on its own. The queue has to stay scannable, so a brief from the
 * agent and steps that want written answers live here instead. When the row is
 * finished the window turns into the receipt, which is what you hand back.
 */
export default function Detail({ id }: { id: string }): React.JSX.Element {
  const [row, setRow] = useState<Row | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    let alive = true

    const load = async (): Promise<void> => {
      const current = await window.listan.row(id)
      if (!alive) return

      if (current) {
        setRow(current)
        return
      }

      // The row may have been finished from the queue window while this one was
      // open; then the receipt is what there is to show.
      const existing = await window.listan.receiptForRow(id)
      if (!alive) return

      if (existing) setReceipt(existing)
      else setMissing(true)
    }

    const off = window.listan.onChanged(load)
    load()

    return () => {
      alive = false
      off()
    }
  }, [id, version])

  async function toggle(stepId: string, done: boolean): Promise<void> {
    await window.listan.setStep(id, stepId, done)
    reload()
  }

  async function answer(stepId: string, value: string): Promise<void> {
    await window.listan.setAnswer(id, stepId, value)
  }

  async function finish(): Promise<void> {
    setReceipt(await window.listan.complete(id, 'completed', note))
  }

  async function copy(format: 'answers' | 'prompt'): Promise<void> {
    if (!receipt) return

    await window.listan.copy(await window.listan.renderReceipt(receipt, format))
    setCopied(format)
    setTimeout(() => setCopied(null), 1800)
  }

  if (missing) {
    return (
      <Shell title="listan">
        <p className="m-auto text-sm text-fg-subtle">Raden finns inte längre.</p>
      </Shell>
    )
  }

  if (receipt) {
    return (
      <Shell title={receipt.text}>
        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-sm text-fg-muted">
            Klar. Kvittot ligger kvar i fjorton dagar och kan hämtas med{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-[13px]">
              listan result {receipt.rowId.slice(0, 8)}
            </code>
            .
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => copy('answers')}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90"
            >
              {copied === 'answers' ? 'Kopierat' : 'Kopiera svar'}
            </button>
            <p className="text-xs text-fg-subtle">
              För en tråd som fortfarande väntar och redan vet vad den bad om.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => copy('prompt')}
              className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-surface-2"
            >
              {copied === 'prompt' ? 'Kopierat' : 'Kopiera återlämning'}
            </button>
            <p className="text-xs text-fg-subtle">
              För en ny tråd som aldrig såg något av det här.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  if (!row) return <Shell title="listan">{null}</Shell>

  const done = row.steps.filter((step) => step.done).length

  return (
    <Shell title={row.text}>
      <div className="flex flex-col gap-5 px-5 py-4">
        {row.link && (
          <button
            onClick={() => window.listan.open(row.id)}
            className="flex items-center gap-2 self-start text-sm text-accent transition-opacity duration-150 hover:opacity-80"
          >
            <OpenIcon />
            Öppna länken
          </button>
        )}

        {row.body && <Markdown source={row.body} />}

        {row.steps.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
              Steg{' '}
              <span className="tabular-nums">
                {done}/{row.steps.length}
              </span>
            </p>

            {row.steps.map((step) => (
              <div key={step.id} className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
                  <span className="relative mt-0.5 flex size-[17px] shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={step.done}
                      onChange={(event) => toggle(step.id, event.target.checked)}
                      className="peer size-[17px] cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-border-strong bg-surface transition-colors duration-150 checked:border-accent checked:bg-accent"
                    />
                    <span className="pointer-events-none absolute text-accent-fg opacity-0 peer-checked:opacity-100">
                      <TickIcon />
                    </span>
                  </span>
                  <span className={step.done ? 'text-fg-subtle line-through' : ''}>
                    {step.text}
                  </span>
                </label>

                {step.expects !== 'none' && (
                  <input
                    defaultValue={step.answer ?? ''}
                    onBlur={(event) => answer(step.id, event.target.value)}
                    placeholder={step.expects === 'url' ? 'Klistra in en länk' : 'Vad hände?'}
                    className="ml-[29px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors duration-150 placeholder:text-fg-subtle focus:border-border-strong"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Notering
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Det agenten inte kan se själv"
            className="resize-none rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-fg-subtle focus:border-border-strong"
          />
        </div>

        <button
          onClick={finish}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90"
        >
          Klar
        </button>
      </div>
    </Shell>
  )
}

function Shell({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col bg-bg">
      <header
        className="flex items-center gap-3 px-5"
        style={{ ...DRAG, height: 40, paddingRight: 140 }}
      >
        <span className="truncate text-[13px] font-medium text-fg-subtle" style={NO_DRAG}>
          {title}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
