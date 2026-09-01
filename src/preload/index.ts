import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Row, Tab } from '../shared/types'

export interface Snapshot {
  tabs: Tab[]
  rows: Row[]
}

const api = {
  read: (): Promise<Snapshot> => ipcRenderer.invoke('queue:read'),
  setStep: (rowId: string, stepId: string, done: boolean): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:setStep', rowId, stepId, done),
  remove: (id: string): Promise<Snapshot> => ipcRenderer.invoke('queue:remove', id),
  requeue: (id: string, tab?: string): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:requeue', id, tab),
  reorder: (tab: string, ids: string[]): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:reorder', tab, ids),
  hideOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:hide'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  onUpdateReady: (listener: (version: string) => void): (() => void) => {
    const handler = (_event: unknown, version: string): void => listener(version)
    ipcRenderer.on('update:ready', handler)
    return () => ipcRenderer.off('update:ready', handler)
  },
  open: (id: string): Promise<boolean> => ipcRenderer.invoke('queue:open', id),
  onChanged: (listener: () => void): (() => void) => {
    const handler = (): void => listener()
    ipcRenderer.on('queue:changed', handler)
    return () => ipcRenderer.off('queue:changed', handler)
  }
}

export type QueueApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('listan', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.listan = api
}
