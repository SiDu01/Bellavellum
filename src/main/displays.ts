import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DisplayInfo } from '../shared/types.ts'

/** Remembered player display. Windows may renumber display ids, so label and size are a fallback. */
export type SavedDisplay = Pick<DisplayInfo, 'id' | 'label' | 'width' | 'height'>

export function findDisplay(saved: SavedDisplay | null, displays: DisplayInfo[]): DisplayInfo | null {
  if (!saved) return null
  return (
    displays.find((d) => d.id === saved.id && d.label === saved.label) ??
    displays.find((d) => d.label === saved.label && d.width === saved.width && d.height === saved.height) ??
    null
  )
}

const settingsFile = (dataDir: string): string => join(dataDir, 'settings.json')

export function loadPlayerDisplay(dataDir: string): SavedDisplay | null {
  try {
    const v: unknown = JSON.parse(readFileSync(settingsFile(dataDir), 'utf8'))
    const d = typeof v === 'object' && v !== null ? (v as Record<string, unknown>)['playerDisplay'] : null
    if (typeof d !== 'object' || d === null) return null
    const { id, label, width, height } = d as Record<string, unknown>
    if (typeof id !== 'number' || typeof label !== 'string' || typeof width !== 'number' || typeof height !== 'number') return null
    return { id, label, width, height }
  } catch {
    // Missing or hand-broken settings: just ask again.
    return null
  }
}

export function savePlayerDisplay(dataDir: string, d: SavedDisplay): void {
  const { id, label, width, height } = d
  writeFileSync(settingsFile(dataDir), JSON.stringify({ playerDisplay: { id, label, width, height } }, null, 2))
}
