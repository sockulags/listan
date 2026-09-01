import { BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

/** Matches the overlay's own layout; the window is deliberately not resizable. */
const WIDTH = 320
const HEIGHT = 132
const MARGIN = 24

const HOTKEY = 'CommandOrControl+Shift+K'

let overlay: BrowserWindow | null = null

function create(): BrowserWindow {
  const window = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#faf9f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 'screen-saver' keeps it above full-screen windows too, which is the whole
  // point of a pinned overlay.
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#overlay`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  }

  window.on('closed', () => {
    overlay = null
  })

  return window
}

function place(window: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay()
  window.setPosition(
    workArea.x + workArea.width - WIDTH - MARGIN,
    workArea.y + workArea.height - HEIGHT - MARGIN
  )
}

export function toggleOverlay(): void {
  if (overlay?.isVisible()) {
    overlay.hide()
    return
  }

  if (!overlay) {
    overlay = create()
    place(overlay)
  }

  // showInactive so the overlay never steals focus from what you were doing.
  overlay.showInactive()
}

export function registerOverlay(): () => void {
  ipcMain.handle('overlay:hide', () => overlay?.hide())

  const bound = globalShortcut.register(HOTKEY, toggleOverlay)
  if (!bound) {
    // Another application owns the combination. The overlay still works from
    // the window; only the shortcut is unavailable.
    console.warn(`listan: kunde inte registrera ${HOTKEY}`)
  }

  return () => {
    globalShortcut.unregister(HOTKEY)
    ipcMain.removeHandler('overlay:hide')
    overlay?.destroy()
    overlay = null
  }
}
