import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { AppInfo } from '../shared/types'
import { ensureDataDir, resolveDataDir } from './dataDir'

type View = 'dm' | 'player'

function load(win: BrowserWindow, view: View): void {
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

  ipcMain.handle('info', (): AppInfo => ({ dataDir, displayCount: screen.getAllDisplays().length }))
  createWindows()
})

app.on('window-all-closed', () => app.quit())
