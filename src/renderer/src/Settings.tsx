import { useEffect, useState } from 'react'
import type { Settings as Values } from '@shared/types'

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties

export default function Settings(): React.JSX.Element {
  const [values, setValues] = useState<Values | null>(null)
  const [paths, setPaths] = useState<{ data: string; plugin: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const load = async (): Promise<void> => {
      const [settings, where] = await Promise.all([
        window.listan.getSettings(),
        window.listan.paths()
      ])
      if (!alive) return
      setValues(settings)
      setPaths(where)
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  async function save(next: Values): Promise<void> {
    setValues(next)
    await window.listan.setSettings(next)
  }

  async function copy(label: string, text: string): Promise<void> {
    await window.listan.copy(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center px-5" style={{ ...DRAG, height: 40, paddingRight: 140 }}>
        <span className="text-[13px] font-medium text-fg-subtle">Inställningar</span>
      </header>

      {values && paths && (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={values.allowWaiting}
              onChange={(event) => save({ ...values, allowWaiting: event.target.checked })}
              className="mt-0.5 size-[17px] shrink-0 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-border-strong bg-surface transition-colors duration-150 checked:border-accent checked:bg-accent"
            />
            <span className="flex flex-col gap-1">
              <span className="text-[14.5px]">Låt agenttrådar vänta på rader</span>
              <span className="text-xs leading-relaxed text-fg-subtle">
                En tråd kan blockera på en rad och återupptas när du bockar av den. Stängs det av
                avvisas <code className="rounded bg-surface-2 px-1">listan wait</code> och trådarna
                får hämta kvittot själva i efterhand.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={values.resolveGithub}
              onChange={(event) => save({ ...values, resolveGithub: event.target.checked })}
              className="mt-0.5 size-[17px] shrink-0 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-border-strong bg-surface transition-colors duration-150 checked:border-accent checked:bg-accent"
            />
            <span className="flex flex-col gap-1">
              <span className="text-[14.5px]">Stäng rader vars PR är avgjord</span>
              <span className="text-xs leading-relaxed text-fg-subtle">
                Rader som pekar på en GitHub-PR kontrolleras var femte minut med{' '}
                <code className="rounded bg-surface-2 px-1">gh</code>. Är PR:en mergad eller stängd
                avslutas raden som <em>auto-resolved</em>, aldrig som om du gjort arbetet. Går
                kontrollen inte igenom lämnas raden i fred.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[14.5px]">Tillåtna webhook-mål</span>
            <textarea
              defaultValue={values.webhookAllowlist.join('\n')}
              onBlur={(event) =>
                save({
                  ...values,
                  webhookAllowlist: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                })
              }
              rows={3}
              placeholder="https://hooks.example.se/listan"
              className="resize-none rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12.5px] outline-none transition-colors duration-150 placeholder:text-fg-subtle focus:border-border-strong"
            />
            <span className="text-xs leading-relaxed text-fg-subtle">
              En adress per rad, https bara. En agent kan bara ange{' '}
              <code className="rounded bg-surface-2 px-1">--webhook</code> mot något som står här.
              Tom lista betyder att inga mål accepteras.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[14.5px]">Tema</span>
            <div className="flex gap-1.5">
              {(['system', 'light', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => save({ ...values, theme: option })}
                  className={`rounded-full px-3 py-1 text-[13.5px] transition-colors duration-150 ${
                    values.theme === option
                      ? 'bg-accent-soft font-medium text-accent-soft-fg'
                      : 'text-fg-muted'
                  }`}
                >
                  {option === 'system' ? 'Följ systemet' : option === 'light' ? 'Ljust' : 'Mörkt'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[14.5px]">Sökvägar</span>

            {[
              { label: 'Data', value: paths.data },
              { label: 'Plugin', value: paths.plugin }
            ].map((entry) => (
              <div key={entry.label} className="flex flex-col gap-1">
                <span className="text-xs text-fg-subtle">{entry.label}</span>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1.5 text-[12.5px] text-fg-muted">
                    {entry.value}
                  </code>
                  <button
                    onClick={() => copy(entry.label, entry.value)}
                    className="shrink-0 rounded-md border border-border-strong px-2.5 py-1.5 text-xs transition-colors duration-150 hover:bg-surface-2"
                  >
                    {copied === entry.label ? 'Kopierat' : 'Kopiera'}
                  </button>
                </div>
              </div>
            ))}

            <p className="text-xs leading-relaxed text-fg-subtle">
              Peka din agentklient på plugin-mappen en gång. Den skrivs om vid varje start, så
              plugin-versionen följer appversionen.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
