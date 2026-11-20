import type { AssetKind, Scene } from './types.ts'

/** Asset names are paths relative to their category folder, "/"-separated: "Dungeons/Sewers.jpg". */
export const parentOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))
export const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
export const joinPath = (...parts: string[]): string => parts.filter(Boolean).join('/')

/** Where `name` ends up when `from` (a file or folder) moves to `to`; null if unaffected. */
export function movedPath(name: string, from: string, to: string): string | null {
  if (name === from) return to
  return name.startsWith(`${from}/`) ? to + name.slice(from.length) : null
}

/** The scene with every reference to the moved asset or folder updated; the same object when nothing matched. */
export function renameRefs(scene: Scene, kind: AssetKind, from: string, to: string): Scene {
  let changed = false
  const move = <T extends { kind: AssetKind; name: string }>(item: T): T => {
    const name = item.kind === kind ? movedPath(item.name, from, to) : null
    if (name === null) return item
    changed = true
    return { ...item, name }
  }
  const layers = scene.layers.map((l) => {
    const moved = move(l)
    if (kind !== 'effects') return moved
    const areas = moved.areas.map((a) => {
      const asset = a.asset === undefined ? null : movedPath(a.asset, from, to)
      if (asset === null) return a
      changed = true
      return { ...a, asset }
    })
    return areas.some((a, i) => a !== moved.areas[i]) ? { ...moved, areas } : moved
  })
  const tokens = scene.tokens.map(move)
  return changed ? { ...scene, layers, tokens } : scene
}
