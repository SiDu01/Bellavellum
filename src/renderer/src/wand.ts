import type { Grid } from '../../shared/types'
import { cellsInRect } from './rooms.ts'

type Square = [number, number, number]
export type Point = { x: number; y: number }
export type Rgb = [number, number, number]

/** Even-odd ray casting. */
export function insidePolygon(poly: Point[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (!a || !b) continue
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Grid cells whose center lies inside the outline. */
export function cellsInPolygon(grid: Grid, poly: Point[]): Square[] {
  if (poly.length < 3) return []
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const rect = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  return cellsInRect(grid, rect).filter(([cx, cy, s]) => insidePolygon(poly, cx + s / 2, cy + s / 2))
}

const median = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0

/**
 * The floor inside a rough outline: cells close to the floor color, the largest connected patch of them,
 * plus anything that patch encloses (tables, rugs). The floor color is the median of the cells not on the
 * outline's edge, since a rough outline mostly catches walls and outside there.
 */
export function pickFloor(cells: Square[], colors: Rgb[], tolerance: number): Square[] {
  const first = cells[0]
  if (!first) return []
  const [x0, y0, s] = first
  const at = new Map<string, number>()
  const pos = cells.map(([x, y]) => [Math.round((x - x0) / s), Math.round((y - y0) / s)] as const)
  pos.forEach(([i, j], n) => at.set(`${i},${j}`, n))
  const neighbors = (n: number): (number | undefined)[] => {
    const [i = 0, j = 0] = pos[n] ?? []
    return [at.get(`${i + 1},${j}`), at.get(`${i - 1},${j}`), at.get(`${i},${j + 1}`), at.get(`${i},${j - 1}`)]
  }
  const edge = cells.map((_, n) => neighbors(n).some((m) => m === undefined))

  const inner = colors.filter((_, n) => !edge[n])
  const sample = inner.length > 0 ? inner : colors
  const ref = [0, 1, 2].map((c) => median(sample.map((rgb) => rgb[c] ?? 0)))
  const match = colors.map((rgb) => Math.hypot(rgb[0] - (ref[0] ?? 0), rgb[1] - (ref[1] ?? 0), rgb[2] - (ref[2] ?? 0)) <= tolerance)

  /** Cells reachable from `start` through cells passing `ok`. */
  function flood(start: number[], ok: (n: number) => boolean): Set<number> {
    const seen = new Set(start)
    const stack = [...start]
    for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
      for (const m of neighbors(n)) {
        if (m !== undefined && !seen.has(m) && ok(m)) {
          seen.add(m)
          stack.push(m)
        }
      }
    }
    return seen
  }

  let floor = new Set<number>()
  const visited = new Set<number>()
  match.forEach((ok, n) => {
    if (!ok || visited.has(n)) return
    const patch = flood([n], (m) => match[m] === true)
    patch.forEach((m) => visited.add(m))
    if (patch.size > floor.size) floor = patch
  })

  // What the floor does not separate from the outline's edge is outside; the rest is enclosed.
  const outsideStart = cells.map((_, n) => n).filter((n) => edge[n] && !floor.has(n))
  const outside = flood(outsideStart, (m) => !floor.has(m))
  return cells.filter((_, n) => !outside.has(n))
}
