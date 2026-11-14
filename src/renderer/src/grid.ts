import type { Grid, ViewRect } from '../../shared/types'

const SQRT3 = Math.sqrt(3)

/** Center-to-corner radius of a hex whose flat sides are `size` apart. */
export const hexRadius = (size: number): number => size / SQRT3

// A flat-top hex grid is a pointy-top grid mirrored across the diagonal, so hex math runs in pointy space.
const toPointy = (g: Grid, x: number, y: number): [number, number] => (g.type === 'hex-flat' ? [y, x] : [x, y])

function cubeRound(q: number, r: number): [number, number] {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return [rq, rr]
}

/** Center for a token of `cells` cells dropped at (x, y). Square tokens align their edges to the grid. */
export function snap(g: Grid, x: number, y: number, cells: number): { x: number; y: number } {
  if (g.type === 'square') {
    const half = (cells * g.size) / 2
    return {
      x: g.offsetX + Math.round((x - half - g.offsetX) / g.size) * g.size + half,
      y: g.offsetY + Math.round((y - half - g.offsetY) / g.size) * g.size + half
    }
  }
  const r = hexRadius(g.size)
  const [lx, ly] = toPointy(g, x - g.offsetX, y - g.offsetY)
  const [q, s] = cubeRound(((SQRT3 / 3) * lx - ly / 3) / r, ((2 / 3) * ly) / r)
  const [px, py] = toPointy(g, r * SQRT3 * (q + s / 2), r * 1.5 * s)
  return { x: px + g.offsetX, y: py + g.offsetY }
}

/**
 * Grid from a rectangle the DM dragged over `count` cells of the printed grid
 * (for hex: `count` cells in a row, flat side to flat side).
 */
export function calibrate(g: Grid, rect: ViewRect, count: number): Grid {
  if (g.type === 'square') {
    return { ...g, size: (rect.width + rect.height) / 2 / count, offsetX: rect.x, offsetY: rect.y }
  }
  if (g.type === 'hex-pointy') {
    const size = rect.width / count
    return { ...g, size, offsetX: rect.x + size / 2, offsetY: rect.y + rect.height / 2 }
  }
  const size = rect.height / count
  return { ...g, size, offsetX: rect.x + rect.width / 2, offsetY: rect.y + size / 2 }
}

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): ViewRect {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }
}
