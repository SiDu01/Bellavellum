import type { Area, Grid, Layer, LocalGrid, Scene, ViewRect } from '../../shared/types'
import { burstCells, coneCells, coneStart, dist, emanationCells, lineCells, lineDist, snapLike, snapOrigin, spaceDist, squares, type Cell } from './areas.ts'
import { snap } from './grid.ts'
import type { Point } from './wand.ts'

function turn(p: Point, deg: number): Point {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

/** Scene point → the layer's own px (unscaled, origin at its top-left corner). */
export function toLayer(l: Layer, p: Point): Point {
  const q = turn({ x: (p.x - l.x) / l.scale, y: (p.y - l.y) / l.scale }, -l.rotation)
  return { x: q.x + l.width / 2, y: q.y + l.height / 2 }
}

export function fromLayer(l: Layer, p: Point): Point {
  const q = turn({ x: p.x - l.width / 2, y: p.y - l.height / 2 }, l.rotation)
  return { x: l.x + q.x * l.scale, y: l.y + q.y * l.scale }
}

const inRect = (r: ViewRect, p: Point) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height

/** The visible part of the layer, in its own px. */
export const cropRect = (l: Layer): ViewRect => ({
  x: l.crop.left * l.width,
  y: l.crop.top * l.height,
  width: (1 - l.crop.left - l.crop.right) * l.width,
  height: (1 - l.crop.top - l.crop.bottom) * l.height
})

/** A grid and the mapping between its plane and the scene. */
export interface Frame {
  grid: Grid
  toScene: (p: Point) => Point
  fromScene: (p: Point) => Point
  /** Scene units per plane unit. */
  scale: number
}

export const sceneFrame = (grid: Grid): Frame => ({ grid, scale: 1, toScene: (p) => p, fromScene: (p) => p })

export const localFrame = (l: Layer, g: LocalGrid): Frame => ({
  grid: g,
  scale: l.scale,
  toScene: (p) => fromLayer(l, turn(p, g.rotation)),
  fromScene: (p) => turn(toLayer(l, p), -g.rotation)
})

/** Top visible layer whose visible part contains the scene point. */
export function layerAt(scene: Scene, p: Point): Layer | null {
  for (let i = scene.layers.length - 1; i >= 0; i--) {
    const l = scene.layers[i]
    if (l?.visible && inRect(cropRect(l), toLayer(l, p))) return l
  }
  return null
}

/** The grid at a scene point: the top local grid there, else the scene grid. Layers without one do not block. */
export function frameAt(scene: Scene, p: Point): Frame {
  for (let i = scene.layers.length - 1; i >= 0; i--) {
    const l = scene.layers[i]
    if (!l?.visible || !inRect(cropRect(l), toLayer(l, p))) continue
    for (const g of l.grids) {
      const f = localFrame(l, g)
      if (inRect(g.region, f.fromScene(p))) return f
    }
  }
  return sceneFrame(scene.grid)
}

export const snapIn = (f: Frame, p: Point, cells: number): Point => {
  const q = f.fromScene(p)
  return f.toScene(snap(f.grid, q.x, q.y, cells))
}

/** Token center after a drop at p; p itself where that grid does not snap. */
export function snapToken(scene: Scene, p: Point, cells: number): Point {
  const f = frameAt(scene, p)
  return f.grid.snap ? snapIn(f, p, cells) : p
}

export function cellSizeAt(scene: Scene, p: Point): number {
  const f = frameAt(scene, p)
  return f.grid.size * f.scale
}

export interface AreaGeometry {
  /** Affected cells as quads in scene coordinates. */
  cells: Point[][]
  /** Scene coordinates; `to` carries the label. */
  from: Point
  to: Point
  feet: number
}

/** Where an area lands on the grid under its origin. Recomputed on every render, so it follows grid edits. */
export function areaGeometry(scene: Scene, layer: Layer | null, a: Area): AreaGeometry {
  const at = (x: number, y: number) => (layer ? fromLayer(layer, { x, y }) : { x, y })
  const o = at(a.x, a.y)
  const t = at(a.tx, a.ty)
  const f = frameAt(scene, o)
  const g = f.grid
  const unit = (p: Point) => {
    const q = f.fromScene(p)
    return { x: (q.x - g.offsetX) / g.size, y: (q.y - g.offsetY) / g.size }
  }
  const scene_ = (x: number, y: number) => f.toScene({ x: g.offsetX + x * g.size, y: g.offsetY + y * g.size })
  const uo = unit(o)
  const ut = unit(t)
  if (g.type !== 'square') {
    // shortcut: hex grids only get a ruler (center distance in cells), no PF2e templates; add hex templates when needed.
    return { cells: [], from: o, to: t, feet: Math.round(Math.hypot(ut.x - uo.x, ut.y - uo.y)) * 5 }
  }
  const quads = (cells: Cell[]) =>
    cells.map(([i, j]) => [scene_(i, j), scene_(i + 1, j), scene_(i + 1, j + 1), scene_(i, j + 1)])
  // The cell under the pointer is the target: the area reaches it, and its PF2e distance is the range.
  const [ti, tj] = [Math.floor(ut.x), Math.floor(ut.y)]
  if (a.shape === 'burst' && a.size > 1) {
    // PF2e emanation from a large creature: counted from the edge of its whole space.
    const cx = Math.round(uo.x - a.size / 2)
    const cy = Math.round(uo.y - a.size / 2)
    const r = Math.max(1, spaceDist(ti, tj, cx, cy, a.size))
    return { cells: quads(emanationCells(cx, cy, a.size, r)), from: scene_(cx + a.size / 2, cy + a.size / 2), to: t, feet: 5 * r }
  }
  // Every shape starts at the nearer of a grid intersection and a cell center.
  const so = snapOrigin(uo)
  const from = scene_(so.x, so.y)
  // Aimed at the target cell's center, so the line or cone passes through it.
  const angle = Math.atan2(tj + 0.5 - so.y, ti + 0.5 - so.x)
  switch (a.shape) {
    case 'ruler': {
      const st = snapLike(so, ut)
      return { cells: [], from, to: scene_(st.x, st.y), feet: 5 * squares(st.x - so.x, st.y - so.y) }
    }
    case 'burst': {
      const r = Math.max(1, dist(ti, tj, so))
      return { cells: quads(burstCells(so, r)), from, to: t, feet: 5 * r }
    }
    case 'cone': {
      // Cones point straight or diagonally, as the printed PF2e templates do.
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
      const start = coneStart(so, snapped)
      const r = Math.max(1, dist(ti, tj, start))
      return { cells: quads(coneCells(so, snapped, r)), from: scene_(start.x, start.y), to: t, feet: 5 * r }
    }
    case 'line': {
      const r = Math.max(1, lineDist(ti, tj, so))
      return { cells: quads(lineCells(so, angle, r)), from, to: t, feet: 5 * r }
    }
  }
}
