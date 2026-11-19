import { app, BrowserWindow, dialog, ipcMain, net, protocol, screen, type Display } from 'electron'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppInfo, AssetKind, DisplayInfo, Scene, Size } from '../shared/types'
import { ensureDataDir, resolveDataDir } from './dataDir'
import { findDisplay, loadPlayerDisplay, savePlayerDisplay } from './displays'
import { loadGeminiKey, saveGeminiKey, suggestRooms } from './gemini'
import { importFiles, isAssetKind, isInside, listAssets, removeAsset, saveAsset, saveThumb } from './library'
import { checkSceneId, deleteScene, listScenes, loadScene, saveFog, saveScene } from './scenes'

type View = 'dm' | 'player'

// bv://data/<path> serves files from the data folder; stream for video, CORS so thumbnails can be drawn to canvas.
protocol.registerSchemesAsPrivileged([
  { scheme: 'bv', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
])

const preload = join(__dirname, '../preload/index.js')
let dm: BrowserWindow | null = null
let player: BrowserWindow | null = null
let playerDisplayId: number | null = null
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

function playerSize(): Size | null {
  if (!player) return null
  const [width = 0, height = 0] = player.getContentSize()
  return { width, height }
}

/** The DM frames the player view in the player's aspect ratio, so it must know every change. */
const sendPlayerSize = (): void => dm?.webContents.send('player:size', playerSize())

function displayInfo(d: Display): DisplayInfo {
  return {
    id: d.id,
    label: d.label || `Bildschirm ${d.id}`,
    width: d.size.width,
    height: d.size.height,
    primary: d.id === screen.getPrimaryDisplay().id,
    player: player !== null && d.id === playerDisplayId
  }
}

/** Fullscreen on `display`; on the DM's own screen a plain window, so it does not cover the editor. */
function openPlayer(display: Display): void {
  if (player) {
    // Recreating is more reliable than moving a fullscreen window between displays.
    const old = player
    player = null
    old.removeAllListeners('closed')
    old.destroy()
  }
  const primary = display.id === screen.getPrimaryDisplay().id
  const { x, y, width, height } = display.workArea
  const win = new BrowserWindow({
    title: 'Bellavellum – Spieler',
    backgroundColor: '#000000',
    ...(primary
      ? { x: x + Math.round((width - 960) / 2), y: y + Math.round((height - 540) / 2), width: 960, height: 540 }
      : { ...display.bounds, fullscreen: true }),
    webPreferences: { preload }
  })
  player = win
  playerDisplayId = display.id
  win.setMenu(null)
  // index.html's <title> would rename it to "Bellavellum", same as the DM window.
  win.on('page-title-updated', (e) => e.preventDefault())
  win.on('resize', sendPlayerSize)
  win.on('closed', () => {
    if (player !== win) return
    player = null
    sendPlayerSize()
  })
  load(win, 'player')
  sendPlayerSize()
}

function createWindows(): void {
  dm = new BrowserWindow({ width: 1280, height: 800, minWidth: 900, minHeight: 600, title: 'Bellavellum', webPreferences: { preload } })
  dm.setMenu(null)
  // Without the menu there is no DevTools accelerator; keep F12 in dev.
  if (!app.isPackaged) {
    const wc = dm.webContents
    wc.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') wc.toggleDevTools()
    })
  }
  load(dm, 'dm')
  dm.on('closed', () => {
    // Gone: the player window closing during quit must not message it.
    dm = null
    // Quit only after the scene writes the DM sent while closing.
    void queue.then(() => app.quit())
  })
}

function sendLive(scene: Scene | null): void {
  player?.webContents.send('live:scene', scene)
  // The DM's preview of the player screen.
  dm?.webContents.send('live:scene', scene)
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
  ipcMain.handle('player:size', () => playerSize())
  ipcMain.handle('displays:list', () => screen.getAllDisplays().map(displayInfo))
  ipcMain.handle('player:open', (_e, id: unknown) => {
    const display = screen.getAllDisplays().find((d) => d.id === id)
    if (!display) throw new Error('Bildschirm nicht mehr angeschlossen')
    openPlayer(display)
    savePlayerDisplay(dataDir, displayInfo(display))
  })

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
  ipcMain.handle('scenes:fog', (_e, id: unknown, bytes: Uint8Array) => serial(() => saveFog(dataDir, id, bytes)))
  ipcMain.handle('scenes:remove', async (_e, id: unknown) => {
    await serial(() => deleteScene(dataDir, id))
    if (id === liveId) {
      liveId = null
      sendLive(null)
    }
  })

  // The key never goes back to the renderer.
  ipcMain.handle('gemini:hasKey', () => loadGeminiKey(dataDir) !== null)
  ipcMain.handle('gemini:setKey', (_e, key: unknown) => saveGeminiKey(dataDir, typeof key === 'string' ? key : ''))
  ipcMain.handle('gemini:rooms', (_e, jpeg: unknown, cols: unknown, rows: unknown) => {
    const key = loadGeminiKey(dataDir)
    if (!key) throw new Error('Kein Gemini-API-Key gespeichert')
    const count = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 500
    if (!(jpeg instanceof Uint8Array) || !count(cols) || !count(rows)) throw new Error('Ungültige Anfrage')
    return suggestRooms(key, jpeg, cols, rows)
  })

  // Pings, pointer and measuring: straight to the screens, never to disk.
  ipcMain.on('live:transient', (_e, t: unknown) => {
    player?.webContents.send('live:transient', t)
    dm?.webContents.send('live:transient', t)
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
    portableDir: process.env['PORTABLE_EXECUTABLE_DIR'],
    appImage: process.env['APPIMAGE']
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
  // Same display as last time: use it right away. Otherwise the DM picks one.
  const known = findDisplay(loadPlayerDisplay(dataDir), screen.getAllDisplays().map(displayInfo))
  const display = known && screen.getAllDisplays().find((d) => d.id === known.id)
  if (display) openPlayer(display)
})

app.on('window-all-closed', () => void queue.then(() => app.quit()))
