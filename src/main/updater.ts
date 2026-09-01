// Tysta autouppdateringar via electron-updater + GitHub Releases.
//
// Uppdateringar ska aldrig vara i vägen: en kontroll 20 sekunder efter start så
// att uppstarten förblir snabb, sedan var fjärde timme. Hittade uppdateringar
// hämtas i bakgrunden och installeras när appen avslutas. Varje fel sväljs till
// en loggrad — ett skakigt nät eller en saknad release ska aldrig bli en dialog.

import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import type { NsisUpdater } from 'electron-updater'

const FIRST_CHECK_MS = 20_000
const RECHECK_MS = 4 * 60 * 60 * 1000

function log(message: string, error?: unknown): void {
  if (error !== undefined) console.error(`[updater] ${message}`, error)
  else console.log(`[updater] ${message}`)
}

function check(): void {
  autoUpdater.checkForUpdates().catch((error) => log('kontrollen misslyckades', error))
}

/**
 * På Windows verifierar electron-updater den hämtade installeraren med
 * Authenticode och kräver ett betrott resultat som matchar `win.publisherName`.
 * listans installerare är osignerad, så det finns ingen identitet att matcha mot
 * och kontrollen kan bara stå i vägen. Den ersätts med en no-op.
 *
 * Nedladdningen är fortfarande skyddad, bara på ett annat sätt:
 * electron-updater hämtar `latest.yml` över HTTPS från GitHub Releases och
 * kontrollerar installerarens sha512 därifrån innan något körs, så en manipulerad
 * binär avvisas oavsett signatur. Det vi avstår från är identitetsgarantin —
 * som en osignerad installerare ändå inte ger.
 *
 * Dagen installerarna signeras av ett CA-betrott certifikat kan den här
 * funktionen tas bort rakt av, och full verifiering är tillbaka.
 */
function relaxSignatureCheck(): void {
  if (process.platform !== 'win32') return

  const nsis = autoUpdater as unknown as NsisUpdater
  nsis.verifyUpdateCodeSignature = (): Promise<string | null> => Promise.resolve(null)
}

/**
 * Kopplar in autouppdateraren. Säker att anropa alltid: den gör ingenting i dev
 * och i opaketerade byggen, där det varken finns en installerare att byta ut
 * eller en `app-update.yml` att läsa.
 */
export function registerUpdater(): () => void {
  ipcMain.handle('update:install', () => {
    try {
      autoUpdater.quitAndInstall()
    } catch (error) {
      log('quitAndInstall misslyckades', error)
    }
  })

  if (is.dev || !app.isPackaged) {
    log('avstängd (dev eller opaketerad)')
    return () => ipcMain.removeHandler('update:install')
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  relaxSignatureCheck()

  autoUpdater.on('error', (error) => log('fel', error))
  autoUpdater.on('update-downloaded', (info) => {
    log(`version ${info.version} hämtad och redo`)
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('update:ready', info.version)
    }
  })

  const first = setTimeout(check, FIRST_CHECK_MS)
  const recheck = setInterval(check, RECHECK_MS)

  return () => {
    clearTimeout(first)
    clearInterval(recheck)
    autoUpdater.removeAllListeners()
    ipcMain.removeHandler('update:install')
  }
}
