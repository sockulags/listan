import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { readSettings } from '../core/settings'

interface Chrome {
  background: string
  symbol: string
}

/** Window chrome colours, matching the tokens in assets/main.css. */
const CHROME: Record<'light' | 'dark', Chrome> = {
  light: { background: '#faf9f7', symbol: '#56605a' },
  dark: { background: '#1a1917', symbol: '#a8a59d' }
}

export function isDark(): boolean {
  return nativeTheme.shouldUseDarkColors
}

export function chrome(): Chrome {
  return isDark() ? CHROME.dark : CHROME.light
}

/**
 * Follows the system theme. The renderer puts the class on <html> and the
 * native title-bar overlay is repainted here — Windows does not re-theme the
 * window buttons on its own once the colours are set explicitly.
 */
export function registerTheme(): () => void {
  ipcMain.handle('theme:get', () => isDark())

  // A forced light or dark setting is applied through nativeTheme, so both the
  // renderer and the native window buttons follow the same source of truth.
  nativeTheme.themeSource = readSettings().theme

  const apply = (): void => {
    const colours = chrome()

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('theme:changed', isDark())
      window.setBackgroundColor(colours.background)

      if (process.platform === 'win32' && !window.isDestroyed()) {
        try {
          window.setTitleBarOverlay({ color: colours.background, symbolColor: colours.symbol })
        } catch {
          // Windows without an overlay (the frameless one) throws; nothing to do.
        }
      }
    }
  }

  nativeTheme.on('updated', apply)

  return () => {
    nativeTheme.off('updated', apply)
    ipcMain.removeHandler('theme:get')
  }
}
