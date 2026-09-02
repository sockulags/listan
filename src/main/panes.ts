import { BrowserWindow, clipboard, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { chrome } from './theme'
import { readSettings, writeSettings } from '../core/settings'
import { dataDir, pluginDir } from '../core/paths'
import type { Settings } from '../shared/types'

const detail = new Map<string, BrowserWindow>()
let settings: BrowserWindow | null = null

function create(hash: string, width: number, height: number): BrowserWindow {
  const colours = chrome()

  const window = new BrowserWindow({
    width,
    height,
    minWidth: 380,
    minHeight: 260,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: colours.background,
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32'
      ? { titleBarOverlay: { color: colours.background, symbolColor: colours.symbol, height: 40 } }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }

  return window
}

/**
 * A row with a brief or with steps that want written answers is too much for
 * the queue, which has to stay scannable. It gets a window of its own instead.
 */
export function openRow(id: string): void {
  const existing = detail.get(id)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const window = create(`row/${id}`, 520, 620)
  detail.set(id, window)
  window.on('closed', () => detail.delete(id))
}

export function openSettings(): void {
  if (settings && !settings.isDestroyed()) {
    settings.focus()
    return
  }

  settings = create('settings', 460, 460)
  settings.on('closed', () => {
    settings = null
  })
}

export function registerPanes(): () => void {
  ipcMain.handle('panes:openRow', (_event, id: string) => openRow(id))
  ipcMain.handle('panes:openSettings', () => openSettings())

  ipcMain.handle('panes:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('clipboard:write', (_event, text: string) => clipboard.writeText(text))

  // The done view opens links from receipts, whose rows are gone. The target
  // came from an agent, so only http(s) is ever handed to the shell.
  ipcMain.handle('link:open', (_event, target: string) => {
    if (!/^https?:\/\//i.test(target)) return false
    shell.openExternal(target)
    return true
  })

  ipcMain.handle('settings:get', () => readSettings())
  ipcMain.handle('settings:set', (_event, next: Settings) => {
    nativeTheme.themeSource = next.theme
    return writeSettings(next)
  })
  ipcMain.handle('settings:paths', () => ({ data: dataDir(), plugin: pluginDir() }))

  return () => {
    for (const handler of [
      'panes:openRow',
      'panes:openSettings',
      'panes:close',
      'clipboard:write',
      'link:open',
      'settings:get',
      'settings:set',
      'settings:paths'
    ]) {
      ipcMain.removeHandler(handler)
    }

    for (const window of detail.values()) if (!window.isDestroyed()) window.destroy()
    detail.clear()
    settings?.destroy()
    settings = null
  }
}
