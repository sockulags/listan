import { ElectronAPI } from '@electron-toolkit/preload'
import type { QueueApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    listan: QueueApi
  }
}
