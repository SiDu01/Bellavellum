import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppInfo, Asset, AssetKind, ImportResult } from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('info'),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  library: {
    list: (): Promise<Asset[]> => ipcRenderer.invoke('library:list'),
    import: (kind: AssetKind, paths: string[]): Promise<ImportResult> => ipcRenderer.invoke('library:import', kind, paths),
    save: (kind: AssetKind, name: string, bytes: Uint8Array): Promise<string> =>
      ipcRenderer.invoke('library:save', kind, name, bytes),
    saveThumb: (kind: AssetKind, name: string, bytes: Uint8Array): Promise<void> =>
      ipcRenderer.invoke('library:thumb', kind, name, bytes),
    remove: (kind: AssetKind, name: string): Promise<void> => ipcRenderer.invoke('library:remove', kind, name)
  }
}

export type BellavellumApi = typeof api

contextBridge.exposeInMainWorld('bellavellum', api)
