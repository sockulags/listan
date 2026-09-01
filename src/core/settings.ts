import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SETTINGS, type Settings } from '../shared/types'
import { dataDir } from './paths'

function file(): string {
  return join(dataDir(), 'settings.json')
}

/** Unknown or damaged settings fall back to the defaults rather than throwing. */
export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Settings>
    return {
      allowWaiting:
        typeof parsed.allowWaiting === 'boolean'
          ? parsed.allowWaiting
          : DEFAULT_SETTINGS.allowWaiting,
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
          ? parsed.theme
          : DEFAULT_SETTINGS.theme
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settings: Settings): Settings {
  mkdirSync(dataDir(), { recursive: true })
  writeFileSync(file(), `${JSON.stringify(settings, null, 2)}\n`)
  return settings
}
