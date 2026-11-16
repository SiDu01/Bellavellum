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
const dist = (i: number, j: number, o: Point): number => squares(axis(i, o.x), axis(j, o.y))

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
  const gap = (i: number, c: number) => (i < c ? c - i : i >= c + n ? i - (c + n) + 1 : 0)
  const cells: Cell[] = []
  for (let i = cx - r; i < cx + n + r; i++)
    for (let j = cy - r; j < cy + n + r; j++) if (squares(gap(i, cx), gap(j, cy)) <= r) cells.push([i, j])
  return cells
}

const EPS = 1e-9

/**
 * Where a cone starts. From a cell (the caster's) it leaves through the edge or corner the cone points
 * at, as the printed PF2e templates do; an intersection stays put.
 */
export const coneStart = (o: Point, angle: number): Point =>
  Number.isInteger(o.x) && Number.isInteger(o.y)
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

/** 5 ft wide line of `r` squares heading at `angle` radians. From a cell center that cell is the caster's. */
export function lineCells(o: Point, angle: number, r: number): Cell[] {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  return around(o, r, (i, j) => {
    const ox = i + 0.5 - o.x
    const oy = j + 0.5 - o.y
    const side = ox * dy - oy * dx
    // Along a grid line two rows are equally close: take the one on the left of the heading.
    const inside = Math.abs(side) < 0.5 - EPS || (Math.abs(Math.abs(side) - 0.5) <= EPS && side < 0)
    return ox * dx + oy * dy > EPS && inside && dist(i, j, o) <= r
  })
}
