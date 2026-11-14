import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { AppInfo, Asset, AssetKind, ImportResult, Scene, SceneList } from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('info'),
  openPlayer: (): Promise<void> => ipcRenderer.invoke('player:open'),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  library: {
    list: (): Promise<Asset[]> => ipcRenderer.invoke('library:list'),
    import: (kind: AssetKind, paths: string[]): Promise<ImportResult> => ipcRenderer.invoke('library:import', kind, paths),
    save: (kind: AssetKind, name: string, bytes: Uint8Array): Promise<string> =>
      ipcRenderer.invoke('library:save', kind, name, bytes),
    saveThumb: (kind: AssetKind, name: string, bytes: Uint8Array): Promise<void> =>
      ipcRenderer.invoke('library:thumb', kind, name, bytes),
    remove: (kind: AssetKind, name: string): Promise<void> => ipcRenderer.invoke('library:remove', kind, name)
  },
  scenes: {
    list: (): Promise<SceneList> => ipcRenderer.invoke('scenes:list'),
    load: (id: string): Promise<Scene> => ipcRenderer.invoke('scenes:load', id),
    save: (scene: Scene): Promise<void> => ipcRenderer.invoke('scenes:save', scene),
    saveFog: (id: string, png: Uint8Array): Promise<void> => ipcRenderer.invoke('scenes:fog', id, png),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('scenes:remove', id)
  },
  live: {
    id: (): Promise<string | null> => ipcRenderer.invoke('live:id'),
    get: (): Promise<Scene | null> => ipcRenderer.invoke('live:get'),
    set: (id: string | null): Promise<string | null> => ipcRenderer.invoke('live:set', id),
    onScene: (callback: (scene: Scene | null) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, scene: Scene | null): void => callback(scene)
      ipcRenderer.on('live:scene', handler)
      return () => ipcRenderer.off('live:scene', handler)
    }
  }
}

export type BellavellumApi = typeof api

contextBridge.exposeInMainWorld('bellavellum', api)
