import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { dataDir, pluginDir } from '../core/paths'

/**
 * Writes the agent-facing plugin marketplace into the data directory on every
 * start. Pointing a client at that path once is enough: an app update rewrites
 * the folder, so the plugin follows the app version without being published
 * anywhere.
 */
export function installPlugin(): void {
  const source = app.isPackaged
    ? join(process.resourcesPath, 'plugin')
    : join(app.getAppPath(), 'plugin')

  if (!existsSync(source)) return

  const target = pluginDir()
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true, force: true })

  writeShim()
}

/**
 * A shim so the CLI is runnable without a separate Node install. Electron runs
 * as plain Node when ELECTRON_RUN_AS_NODE is set, and reads the bundled script
 * straight out of the asar archive.
 */
function writeShim(): void {
  const bin = join(dataDir(), 'bin')
  mkdirSync(bin, { recursive: true })

  const cli = join(app.getAppPath(), 'out', 'cli', 'index.js')

  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, 'listan.cmd'),
      ['@echo off', 'set ELECTRON_RUN_AS_NODE=1', `"${process.execPath}" "${cli}" %*`, ''].join(
        '\r\n'
      )
    )
    return
  }

  const shell = join(bin, 'listan')
  writeFileSync(
    shell,
    ['#!/bin/sh', `ELECTRON_RUN_AS_NODE=1 "${process.execPath}" "${cli}" "$@"`, ''].join('\n'),
    { mode: 0o755 }
  )
}
