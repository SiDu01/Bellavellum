import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo } from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('info')
}

export type BellavellumApi = typeof api

contextBridge.exposeInMainWorld('bellavellum', api)
