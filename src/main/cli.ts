import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { ipcMain } from 'electron'
import type { CliStatus } from '../shared/types'
import { dataDir } from '../core/paths'
import { appendDir, containsDir } from '../core/pathlist'

const run = promisify(execFile)

const POWERSHELL_TIMEOUT_MS = 15_000

function binDir(): string {
  return join(dataDir(), 'bin')
}

function shimPath(): string {
  return join(binDir(), process.platform === 'win32' ? 'listan.cmd' : 'listan')
}

/**
 * Reads the stored PATH rather than the one this process inherited: the whole
 * question is whether a terminal started later will find the CLI, and the
 * inherited copy is a snapshot from when the app launched.
 */
async function storedPath(scope: 'User' | 'Machine'): Promise<string> {
  try {
    const { stdout } = await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `[Environment]::GetEnvironmentVariable('Path', '${scope}')`
      ],
      { timeout: POWERSHELL_TIMEOUT_MS, windowsHide: true }
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

export async function cliStatus(): Promise<CliStatus> {
  const dir = binDir()
  const supported = process.platform === 'win32'

  if (!supported) {
    return { binDir: dir, shimExists: existsSync(shimPath()), onPath: false, supported }
  }

  const [user, machine] = await Promise.all([storedPath('User'), storedPath('Machine')])

  return {
    binDir: dir,
    shimExists: existsSync(shimPath()),
    onPath: containsDir(user, dir) || containsDir(machine, dir),
    supported
  }
}

/**
 * Appends the shim directory to the user's PATH. This changes something outside
 * the app, so it happens only when you press the button — never on start.
 */
async function addToPath(): Promise<CliStatus> {
  if (process.platform !== 'win32') return cliStatus()

  const dir = binDir()
  const current = await storedPath('User')
  if (containsDir(current, dir)) return cliStatus()

  // The new value goes through the environment rather than into the command
  // text, so no path can ever be read as PowerShell.
  await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "[Environment]::SetEnvironmentVariable('Path', $env:LISTAN_NEW_PATH, 'User')"
    ],
    {
      timeout: POWERSHELL_TIMEOUT_MS,
      windowsHide: true,
      env: { ...process.env, LISTAN_NEW_PATH: appendDir(current, dir) }
    }
  )

  return cliStatus()
}

export function registerCli(): () => void {
  ipcMain.handle('cli:status', () => cliStatus())
  ipcMain.handle('cli:addToPath', () => addToPath())

  return () => {
    ipcMain.removeHandler('cli:status')
    ipcMain.removeHandler('cli:addToPath')
  }
}
