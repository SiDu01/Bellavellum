import { app, BrowserWindow, dialog, ipcMain, net, protocol, screen } from 'electron'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppInfo, AssetKind, Scene } from '../shared/types'
import { ensureDataDir, resolveDataDir } from './dataDir'
import { importFiles, isAssetKind, isInside, listAssets, removeAsset, saveAsset, saveThumb } from './library'
import { checkSceneId, deleteScene, listScenes, loadScene, saveScene } from './scenes'

type View = 'dm' | 'player'

// bv://data/<path> serves files from the data folder; stream for video, CORS so thumbnails can be drawn to canvas.
protocol.registerSchemesAsPrivileged([
  { scheme: 'bv', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
])

const preload = join(__dirname, '../preload/index.js')
let player: BrowserWindow | null = null
let liveId: string | null = null

function load(win: BrowserWindow, view: View): void {
  // Dropping a file outside the drop zone would otherwise navigate the window to it. Reloads stay allowed.
  win.webContents.on('will-navigate', (e) => {
    if (e.url !== win.webContents.getURL()) e.preventDefault()
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(`${devUrl}?view=${view}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } })
}

function openPlayer(): void {
  if (player) {
    player.show()
    return
  }
  const primary = screen.getPrimaryDisplay()
  const external = screen.getAllDisplays().find((d) => d.id !== primary.id)
  player = new BrowserWindow({
    title: 'Bellavellum – Spieler',
    backgroundColor: '#000000',
    // No external display (e.g. while preparing): plain window on the main screen.
    ...(external ? { ...external.bounds, fullscreen: true } : { width: 960, height: 540 }),
    webPreferences: { preload }
  })
  player.setMenu(null)
  player.on('closed', () => (player = null))
  load(player, 'player')
}

function createWindows(): void {
  const dm = new BrowserWindow({ width: 1280, height: 800, title: 'Bellavellum', webPreferences: { preload } })
  load(dm, 'dm')
  dm.on('closed', () => app.quit())
  openPlayer()
}

function sendLive(scene: Scene | null): void {
  player?.webContents.send('live:scene', scene)
}

function kind(value: unknown): AssetKind {
  if (!isAssetKind(value)) throw new Error(`Unbekannte Kategorie: ${String(value)}`)
  return value
}

// Scene writes run one after another: concurrent saves would share the temp file, and a save
// still in flight must not recreate a scene that was just deleted.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.catch(() => undefined)
  return next
}

function registerHandlers(dataDir: string): void {
  protocol.handle('bv', async (req) => {
    const parts = new URL(req.url).pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const file = resolve(dataDir, ...parts)
    if (!isInside(dataDir, file)) return new Response('Forbidden', { status: 403 })
    const res = await net.fetch(pathToFileURL(file).toString(), { headers: req.headers })
    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(res.body, { status: res.status, headers })
  })

  ipcMain.handle('info', (): AppInfo => ({ dataDir, displayCount: screen.getAllDisplays().length }))
  ipcMain.handle('player:open', () => openPlayer())

  ipcMain.handle('library:list', () => listAssets(dataDir))
  ipcMain.handle('library:import', (_e, k: unknown, paths: string[]) => importFiles(dataDir, kind(k), paths))
  ipcMain.handle('library:save', (_e, k: unknown, name: string, bytes: Uint8Array) => saveAsset(dataDir, kind(k), name, bytes))
  ipcMain.handle('library:thumb', (_e, k: unknown, name: string, bytes: Uint8Array) => saveThumb(dataDir, kind(k), name, bytes))
  ipcMain.handle('library:remove', (_e, k: unknown, name: string) => removeAsset(dataDir, kind(k), name))

  ipcMain.handle('scenes:list', () => listScenes(dataDir))
  ipcMain.handle('scenes:load', (_e, id: unknown) => loadScene(dataDir, id))
  ipcMain.handle('scenes:save', async (_e, scene: unknown) => {
    const saved = await serial(() => saveScene(dataDir, scene))
    if (saved.id === liveId) sendLive(saved)
  })
  ipcMain.handle('scenes:remove', async (_e, id: unknown) => {
    await serial(() => deleteScene(dataDir, id))
    if (id === liveId) {
      liveId = null
      sendLive(null)
    }
  })

  ipcMain.handle('live:id', () => liveId)
  ipcMain.handle('live:get', () => (liveId ? loadScene(dataDir, liveId).catch(() => null) : null))
  ipcMain.handle('live:set', async (_e, id: unknown) => {
    const scene = id === null ? null : await loadScene(dataDir, checkSceneId(id))
    liveId = scene?.id ?? null
    sendLive(scene)
    return liveId
  })
}

app.whenReady().then(() => {
  const dataDir = resolveDataDir({
    packaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath(),
    portableDir: process.env['PORTABLE_EXECUTABLE_DIR']
  })
  try {
    ensureDataDir(dataDir)
  } catch (err) {
    dialog.showErrorBox('Bellavellum', `Der Datenordner konnte nicht angelegt werden:\n${dataDir}\n\n${String(err)}`)
    app.quit()
    return
  }

  registerHandlers(dataDir)
  createWindows()
})

app.on('window-all-closed', () => app.quit())
