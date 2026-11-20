import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DATA_SUBDIRS = ['assets/maps', 'assets/props', 'assets/tokens', 'assets/effects', 'scenes']

export interface DataDirInput {
  packaged: boolean
  exePath: string
  appPath: string
  /** PORTABLE_EXECUTABLE_DIR: the portable exe runs from a temp unpack dir, this points back to the stick. */
  portableDir?: string
  /** APPIMAGE: path of the .AppImage file; the app itself runs from a read-only mount in /tmp. */
  appImage?: string
  /** Data folder chosen in the installer, see readInstalledDataDir. */
  installedDir?: string
}

/** The installer writes the chosen data folder to data-path.txt next to the exe; portable builds have none. */
export function readInstalledDataDir(exePath: string): string | undefined {
  try {
    // Inno Setup writes UTF-8 with a BOM.
    return readFileSync(join(dirname(exePath), 'data-path.txt'), 'utf8').replace(/^\uFEFF/, '').trim() || undefined
  } catch {
    return undefined
  }
}

export function resolveDataDir({ packaged, exePath, appPath, portableDir, appImage, installedDir }: DataDirInput): string {
  if (!packaged) return join(appPath, 'data')
  if (installedDir) return installedDir
  return join(portableDir || (appImage && dirname(appImage)) || dirname(exePath), 'data')
}

export function ensureDataDir(dataDir: string): void {
  for (const sub of DATA_SUBDIRS) mkdirSync(join(dataDir, sub), { recursive: true })
}
