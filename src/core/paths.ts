import { homedir } from 'os'
import { join } from 'path'

/**
 * Where listan keeps its data. The CLI runs outside Electron, so this is
 * computed the same way in both places rather than read from app.getPath —
 * two different answers would mean two different queues.
 */
export function dataDir(): string {
  // Repointing APPDATA to test against a scratch queue also moves the config of
  // every other tool that reads it — gh among them, which quietly loses its
  // login. This override moves listan and nothing else.
  const override = process.env.LISTAN_HOME?.trim()
  if (override) return override

  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'listan')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'listan')
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'listan')
}

export function databasePath(): string {
  return join(dataDir(), 'listan.db')
}

/** The marketplace the agent clients are pointed at. */
export function pluginDir(): string {
  return join(dataDir(), 'plugin')
}
