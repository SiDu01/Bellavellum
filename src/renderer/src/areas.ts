/**
 * Pathfinder 2e areas on a square grid, in cell units: cell (i, j) spans [i, i+1] × [j, j+1].
 * An origin is a grid intersection (whole numbers) or a cell center (x.5); each axis on its own.
 */

import type { Point } from './wand.ts'

export type Cell = [number, number]

/** PF2e distance in squares: every second diagonal counts double (5-10-5 ft). */
export function squares(dx: number, dy: number): number {
  const a = Math.abs(dx)
  const b = Math.abs(dy)
  return Math.max(a, b) + Math.floor(Math.min(a, b) / 2)
}

/** Squares from origin coordinate `o` to cell `i`: from a grid line the cell itself counts, from a center it does not. */
const axis = (i: number, o: number): number => (Number.isInteger(o) ? (i >= o ? i - o + 1 : o - i) : Math.abs(i - (o - 0.5)))
const isCorner = (o: Point) => Number.isInteger(o.x) && Number.isInteger(o.y)
/** Squares from `o` to cell (i, j), as bursts and cones count them. */
export const dist = (i: number, j: number, o: Point): number => squares(axis(i, o.x), axis(j, o.y))
/** Squares from `o` to cell (i, j), as lines count them: from an intersection, from their first cell on. */
export const lineDist = (i: number, j: number, o: Point): number =>
  isCorner(o) ? squares(axis(i, o.x) - 1, axis(j, o.y) - 1) + 1 : dist(i, j, o)
/** Squares from a creature's n × n space starting at cell (cx, cy) to cell (i, j). */
export function spaceDist(i: number, j: number, cx: number, cy: number, n: number): number {
  const gap = (k: number, c: number) => (k < c ? c - k : k >= c + n ? k - (c + n) + 1 : 0)
  return squares(gap(i, cx), gap(j, cy))
}

/** The nearer of the closest grid intersection and the closest cell center. */
export function snapOrigin(u: Point): Point {
  const corner = { x: Math.round(u.x), y: Math.round(u.y) }
  const center = { x: Math.floor(u.x) + 0.5, y: Math.floor(u.y) + 0.5 }
  return Math.hypot(u.x - corner.x, u.y - corner.y) <= Math.hypot(u.x - center.x, u.y - center.y) ? corner : center
}

/** Same kind of point as `o` (intersection or center) closest to `u`. */
export const snapLike = (o: Point, u: Point): Point =>
  Number.isInteger(o.x) ? { x: Math.round(u.x), y: Math.round(u.y) } : { x: Math.floor(u.x) + 0.5, y: Math.floor(u.y) + 0.5 }

function around(o: Point, r: number, keep: (i: number, j: number) => boolean): Cell[] {
  const cells: Cell[] = []
  for (let i = Math.floor(o.x) - r - 1; i <= Math.ceil(o.x) + r; i++)
    for (let j = Math.floor(o.y) - r - 1; j <= Math.ceil(o.y) + r; j++) if (keep(i, j)) cells.push([i, j])
  return cells
}

/** Burst of `r` squares. From a cell center it includes that cell. */
export const burstCells = (o: Point, r: number): Cell[] => around(o, r, (i, j) => dist(i, j, o) <= r)

/** Emanation of `r` squares around a creature whose n × n space starts at cell (cx, cy). Includes the space. */
export function emanationCells(cx: number, cy: number, n: number, r: number): Cell[] {
  const cells: Cell[] = []
  for (let i = cx - r; i < cx + n + r; i++)
    for (let j = cy - r; j < cy + n + r; j++) if (spaceDist(i, j, cx, cy, n) <= r) cells.push([i, j])
  return cells
}

const EPS = 1e-9

/**
 * Where a cone starts. From a cell (the caster's) it leaves through the edge or corner the cone points
 * at, as the printed PF2e templates do; an intersection stays put.
 */
export const coneStart = (o: Point, angle: number): Point =>
  isCorner(o)
    ? o
    : { x: o.x + Math.round(Math.cos(angle)) / 2, y: o.y + Math.round(Math.sin(angle)) / 2 }

/** Quarter-circle cone of `r` squares from `o`, pointing at `angle` radians (straight or diagonal). */
export function coneCells(o: Point, angle: number, r: number): Cell[] {
  const s = coneStart(o, angle)
  return around(s, r, (i, j) => {
    const a = Math.atan2(j + 0.5 - s.y, i + 0.5 - s.x)
    const diff = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)))
    return diff <= Math.PI / 4 + EPS && dist(i, j, s) <= r
  })
}

/**
 * 5 ft wide line of `r` squares heading at `angle` radians, as the PF2e templates draw it: one cell
 * per step along the main axis, a staircase. Counted from the first cell, every second diagonal
 * double. From a cell center that cell is the caster's and the line starts next to it.
 */
export function lineCells(o: Point, angle: number, r: number): Cell[] {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const xMain = Math.abs(dx) >= Math.abs(dy)
  const [main, side] = xMain ? [dx, dy] : [dy, dx]
  const [oMain, oSide] = xMain ? [o.x, o.y] : [o.y, o.x]
  const slope = Math.abs(side / main)
  const dMain = main < 0 ? -1 : 1
  // Exactly along a grid line, the line takes the row on the positive side.
  const dSide = side < 0 ? -1 : 1
  const corner = isCorner(o)
  const cells: Cell[] = []
  for (let k = corner ? 0 : 1; ; k++) {
    // Side offset of the cell the line crosses at the middle of main step k.
    const off = corner ? Math.floor((k + 0.5) * slope + EPS) : Math.round(k * slope)
    if ((corner ? squares(k, off) + 1 : squares(k, off)) > r) return cells
    const a = corner ? (dMain > 0 ? oMain + k : oMain - k - 1) : oMain - 0.5 + dMain * k
    const b = corner ? (dSide > 0 ? oSide + off : oSide - off - 1) : oSide - 0.5 + dSide * off
    cells.push(xMain ? [a, b] : [b, a])
  }
}
