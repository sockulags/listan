import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Reason, Receipt, Row, Settings, Tab } from '../shared/types'

export interface Snapshot {
  tabs: Tab[]
  rows: Row[]
}

const api = {
  read: (): Promise<Snapshot> => ipcRenderer.invoke('queue:read'),
  add: (text: string, tab?: string, link?: string): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:add', text, tab, link),
  setStep: (rowId: string, stepId: string, done: boolean): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:setStep', rowId, stepId, done),
  remove: (id: string): Promise<Snapshot> => ipcRenderer.invoke('queue:remove', id),
  setAnswer: (rowId: string, stepId: string, answer: string): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:setAnswer', rowId, stepId, answer),
  row: (id: string): Promise<Row | null> => ipcRenderer.invoke('queue:row', id),
  complete: (id: string, reason: Reason, note?: string): Promise<Receipt | null> =>
    ipcRenderer.invoke('queue:complete', id, reason, note),
  receiptForRow: (rowId: string): Promise<Receipt | null> =>
    ipcRenderer.invoke('queue:receiptForRow', rowId),
  renderReceipt: (receipt: Receipt, format: string): Promise<string> =>
    ipcRenderer.invoke('queue:render', receipt, format),
  openRow: (id: string): Promise<void> => ipcRenderer.invoke('panes:openRow', id),
  openSettings: (): Promise<void> => ipcRenderer.invoke('panes:openSettings'),
  closePane: (): Promise<void> => ipcRenderer.invoke('panes:close'),
  copy: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (next: Settings): Promise<Settings> => ipcRenderer.invoke('settings:set', next),
  paths: (): Promise<{ data: string; plugin: string }> => ipcRenderer.invoke('settings:paths'),
  requeue: (id: string, tab?: string): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:requeue', id, tab),
  reorder: (tab: string, ids: string[]): Promise<Snapshot> =>
    ipcRenderer.invoke('queue:reorder', tab, ids),
  hideOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:hide'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  setHeight: (height: number): void => ipcRenderer.send('window:height', height),
  getTheme: (): Promise<boolean> => ipcRenderer.invoke('theme:get'),
  onTheme: (listener: (dark: boolean) => void): (() => void) => {
    const handler = (_event: unknown, dark: boolean): void => listener(dark)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.off('theme:changed', handler)
  },
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
