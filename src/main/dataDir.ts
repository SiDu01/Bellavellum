import { mkdirSync } from 'node:fs'
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
}

export function resolveDataDir({ packaged, exePath, appPath, portableDir, appImage }: DataDirInput): string {
  if (!packaged) return join(appPath, 'data')
  return join(portableDir || (appImage && dirname(appImage)) || dirname(exePath), 'data')
}

export function ensureDataDir(dataDir: string): void {
  for (const sub of DATA_SUBDIRS) mkdirSync(join(dataDir, sub), { recursive: true })
}
