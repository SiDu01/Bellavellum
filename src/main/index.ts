import { app, BrowserWindow, dialog, ipcMain, net, protocol, screen } from 'electron'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppInfo, AssetKind } from '../shared/types'
import { ensureDataDir, resolveDataDir } from './dataDir'
import { importFiles, isAssetKind, isInside, listAssets, removeAsset, saveAsset, saveThumb } from './library'

type View = 'dm' | 'player'

// bv://data/<path> serves files from the data folder; stream for video, CORS so thumbnails can be drawn to canvas.
protocol.registerSchemesAsPrivileged([
  { scheme: 'bv', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
])

function load(win: BrowserWindow, view: View): void {
  // Dropping a file outside the drop zone would otherwise navigate the window to it. Reloads stay allowed.
  win.webContents.on('will-navigate', (e) => {
    if (e.url !== win.webContents.getURL()) e.preventDefault()
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(`${devUrl}?view=${view}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } })
}

function createWindows(): void {
  const preload = join(__dirname, '../preload/index.js')

  const dm = new BrowserWindow({ width: 1280, height: 800, title: 'Bellavellum', webPreferences: { preload } })
  load(dm, 'dm')
  dm.on('closed', () => app.quit())

  const primary = screen.getPrimaryDisplay()
  const external = screen.getAllDisplays().find((d) => d.id !== primary.id)
  const player = new BrowserWindow({
    title: 'Bellavellum – Spieler',
    backgroundColor: '#000000',
    // No external display (e.g. while preparing): plain window on the main screen.
    ...(external ? { ...external.bounds, fullscreen: true } : { width: 960, height: 540 }),
    webPreferences: { preload }
  })
  player.setMenu(null)
  load(player, 'player')
}

function kind(value: unknown): AssetKind {
  if (!isAssetKind(value)) throw new Error(`Unbekannte Kategorie: ${String(value)}`)
  return value
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
  ipcMain.handle('library:list', () => listAssets(dataDir))
  ipcMain.handle('library:import', (_e, k: unknown, paths: string[]) => importFiles(dataDir, kind(k), paths))
  ipcMain.handle('library:save', (_e, k: unknown, name: string, bytes: Uint8Array) => saveAsset(dataDir, kind(k), name, bytes))
  ipcMain.handle('library:thumb', (_e, k: unknown, name: string, bytes: Uint8Array) => saveThumb(dataDir, kind(k), name, bytes))
  ipcMain.handle('library:remove', (_e, k: unknown, name: string) => removeAsset(dataDir, kind(k), name))
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
