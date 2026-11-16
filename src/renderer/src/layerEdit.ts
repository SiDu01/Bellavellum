import type { Crop, Layer } from '../../shared/types'

const MIN = 0.01

/** Crop that leaves the rectangle between two points in layer px, or null if it is too thin. */
export function cropBetween(l: Layer, a: { x: number; y: number }, b: { x: number; y: number }): Crop | null {
  const fx = (x: number) => Math.min(1, Math.max(0, x / l.width))
  const fy = (y: number) => Math.min(1, Math.max(0, y / l.height))
  const [left, right] = [fx(a.x), fx(b.x)].sort((p, q) => p - q) as [number, number]
  const [top, bottom] = [fy(a.y), fy(b.y)].sort((p, q) => p - q) as [number, number]
  if (right - left < MIN || bottom - top < MIN) return null
  return { top, right: 1 - right, bottom: 1 - bottom, left }
}

/** Cut positions (fractions of the full layer) splitting the visible part into `n` equal pieces. */
export function evenCuts(from: number, to: number, n: number): number[] {
  return Array.from({ length: n - 1 }, (_, i) => from + ((to - from) * (i + 1)) / n)
}

/**
 * Splits a layer along vertical cuts `xs` and horizontal cuts `ys` (fractions of the full layer)
 * into parts that stay where they were. Each keeps a copy of the local grids; an area goes to the
 * part holding its origin.
 */
export function splitLayer(l: Layer, xs: number[], ys: number[]): Layer[] {
  const edges = (lo: number, hi: number, cuts: number[]) => [lo, ...cuts.filter((c) => c > lo + MIN && c < hi - MIN).sort((a, b) => a - b), hi]
  const cx = edges(l.crop.left, 1 - l.crop.right, xs)
  const cy = edges(l.crop.top, 1 - l.crop.bottom, ys)
  const parts: Layer[] = []
  for (let j = 0; j < cy.length - 1; j++)
    for (let i = 0; i < cx.length - 1; i++) {
      const [x0, x1, y0, y1] = [cx[i] ?? 0, cx[i + 1] ?? 1, cy[j] ?? 0, cy[j + 1] ?? 1]
      const holds = (x: number, y: number) =>
        x >= x0 * l.width && (x < x1 * l.width || i === cx.length - 2) && y >= y0 * l.height && (y < y1 * l.height || j === cy.length - 2)
      parts.push({
        ...l,
        id: parts.length === 0 ? l.id : crypto.randomUUID(),
        crop: { left: x0, right: 1 - x1, top: y0, bottom: 1 - y1 },
        grids: l.grids.map((g) => ({ ...g, id: crypto.randomUUID() })),
        areas: l.areas.filter((a) => holds(a.x, a.y))
      })
    }
  return parts
}
