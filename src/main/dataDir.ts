import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DATA_SUBDIRS = ['assets/maps', 'assets/props', 'assets/tokens', 'assets/effects', 'scenes']

export interface DataDirInput {
  packaged: boolean
  exePath: string
  appPath: string
  /** PORTABLE_EXECUTABLE_DIR: the portable exe runs from a temp unpack dir, this points back to the stick. */
  portableDir?: string
}

export function resolveDataDir({ packaged, exePath, appPath, portableDir }: DataDirInput): string {
  if (!packaged) return join(appPath, 'data')
  return join(portableDir || dirname(exePath), 'data')
}

export function ensureDataDir(dataDir: string): void {
  for (const sub of DATA_SUBDIRS) mkdirSync(join(dataDir, sub), { recursive: true })
}
