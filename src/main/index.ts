import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerQueue } from './queue'
import { registerOverlay } from './overlay'
import { registerUpdater } from './updater'
import { registerTheme, chrome } from './theme'
import { registerPanes } from './panes'
import { registerResolver } from './resolver'
import { registerCli } from './cli'
import { installPlugin } from './plugin'

const WIDTH = 460
const MIN_HEIGHT = 260
const MAX_HEIGHT = 760
const TITLEBAR_HEIGHT = 40

let mainWindow: BrowserWindow | null = null
let disposeQueue: (() => void) | undefined
let disposeOverlay: (() => void) | undefined
let disposeUpdater: (() => void) | undefined
let disposeTheme: (() => void) | undefined

function createWindow(): void {
  const colours = chrome()

  const window = new BrowserWindow({
    width: WIDTH,
    height: 520,
    minWidth: 360,
    minHeight: MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: colours.background,
    // Windows still draws its own minimise and close buttons, but the bar takes
    // the app's colour instead of sitting as a grey strip above the palette.
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            color: colours.background,
            symbolColor: colours.symbol,
            height: TITLEBAR_HEIGHT
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = window

  window.on('ready-to-show', () => window.show())

  // The hidden overlay still counts as an open window, so closing the queue has
  // to end the app on its own rather than wait for window-all-closed.
  window.on('closed', () => {
    mainWindow = null
    if (process.platform !== 'darwin') app.quit()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * The queue window is as tall as the queue. Draining it shrinks the window,
 * which is what the app is for; a fixed height left several hundred pixels of
 * dead space under two rows.
 */
function registerAutoHeight(): () => void {
  const handler = (event: Electron.IpcMainEvent, height: number): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (event.sender !== mainWindow.webContents) return

    const wanted = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)))
    const [width, current] = mainWindow.getContentSize()
    if (Math.abs(current - wanted) < 2) return

    mainWindow.setContentSize(width, wanted)
  }

  ipcMain.on('window:height', handler)
  return () => ipcMain.off('window:height', handler)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('se.lucasskog.listan')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  disposeTheme = registerTheme()
  disposeQueue = registerQueue()
  disposeOverlay = registerOverlay()
  disposeUpdater = registerUpdater()
  const disposeHeight = registerAutoHeight()
  const disposePanes = registerPanes()
  const disposeResolver = registerResolver()
  const disposeCli = registerCli()
  installPlugin()
  createWindow()

  app.on('will-quit', () => {
    disposeHeight()
    disposePanes()
    disposeResolver()
    disposeCli()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  disposeUpdater?.()
  disposeUpdater = undefined
  disposeOverlay?.()
  disposeOverlay = undefined
  disposeQueue?.()
  disposeQueue = undefined
  disposeTheme?.()
  disposeTheme = undefined
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
