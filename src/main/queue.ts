import { BrowserWindow, ipcMain, shell } from 'electron'
import { watch } from 'fs'
import { exec } from 'child_process'
import type { Row, Tab } from '../shared/types'
import { Store } from '../core/store'
import { dataDir, databasePath } from '../core/paths'

export interface Snapshot {
  tabs: Tab[]
  rows: Row[]
}

/**
 * The window and the CLI share one sqlite file. Rather than run a local server
 * for the CLI to call, the main process watches the data directory: when an
 * agent writes through the CLI, the window notices and reloads.
 */
export function registerQueue(): () => void {
  const store = new Store(databasePath())
  const snapshot = (): Snapshot => ({ tabs: store.tabs(), rows: store.rows() })

  ipcMain.handle('queue:read', () => snapshot())

  ipcMain.handle('queue:setStep', (_event, rowId: string, stepId: string, done: boolean) => {
    store.setStep(rowId, stepId, done)
    return snapshot()
  })

  ipcMain.handle('queue:remove', (_event, id: string) => {
    store.remove(id)
    return snapshot()
  })

  ipcMain.handle('queue:requeue', (_event, id: string, tab?: string) => {
    store.requeue(id, tab)
    return snapshot()
  })

  ipcMain.handle('queue:reorder', (_event, tab: string, ids: string[]) => {
    store.reorder(tab, ids)
    return snapshot()
  })

  ipcMain.handle('queue:open', (_event, id: string) => {
    const row = store.row(id)
    if (!row?.link) return false

    if (row.link.kind === 'url') shell.openExternal(row.link.target)
    else if (row.link.kind === 'file') shell.openPath(row.link.target)
    else exec(row.link.target)

    return true
  })

  // WAL means writes land in listan.db-wal, so the directory is watched rather
  // than the database file itself.
  let pending: NodeJS.Timeout | undefined
  const watcher = watch(dataDir(), () => {
    clearTimeout(pending)
    pending = setTimeout(() => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('queue:changed')
      }
    }, 150)
  })

  return () => {
    clearTimeout(pending)
    watcher.close()
    ipcMain.removeHandler('queue:read')
    ipcMain.removeHandler('queue:setStep')
    ipcMain.removeHandler('queue:remove')
    ipcMain.removeHandler('queue:requeue')
    ipcMain.removeHandler('queue:reorder')
    ipcMain.removeHandler('queue:open')
    store.close()
  }
}
