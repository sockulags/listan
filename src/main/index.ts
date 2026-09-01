import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerQueue } from './queue'
import { registerOverlay } from './overlay'
import { registerUpdater } from './updater'
import { installPlugin } from './plugin'

let disposeQueue: (() => void) | undefined
let disposeOverlay: (() => void) | undefined
let disposeUpdater: (() => void) | undefined

function createWindow(): void {
  const window = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 360,
    minHeight: 420,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#faf9f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // The hidden overlay still counts as an open window, so closing the queue has
  // to end the app on its own rather than wait for window-all-closed.
  window.on('closed', () => {
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('se.lucasskog.listan')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  disposeQueue = registerQueue()
  disposeOverlay = registerOverlay()
  disposeUpdater = registerUpdater()
  installPlugin()
  createWindow()

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
})

// The overlay is not a window you close your way out of the app with, so only
// the main window closing counts.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
