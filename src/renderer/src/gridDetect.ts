import type { Layer } from '../../shared/types'

/** Square grid in image pixels: cell size and the position of one grid line crossing. */
export interface Detection {
  size: number
  offsetX: number
  offsetY: number
}

const MIN_CELL = 8
const MAX_CELL = 250
/** With only a few cells across, a random texture folds sharply too (seen: 6 cells, false grid). */
const MIN_CELLS_ACROSS = 10
/** Measured: printed grids fold at 1.4–2.6, maps without a grid at most ~1.2. */
const MIN_SHARPNESS = 1.3
/** Square cells: both axes must agree within 3 %. */
const MAX_AXIS_DIFF = 0.03
const PHASE_STEP = 0.25

/** [1, 2, 1] smoothing merges the two edges of a thick line into one peak at its center. */
function smooth(p: Float64Array): Float64Array {
  const out = new Float64Array(p.length)
  for (let i = 0; i < p.length; i++) {
    out[i] = ((p[i - 1] ?? p[i] ?? 0) + 2 * (p[i] ?? 0) + (p[i + 1] ?? p[i] ?? 0)) / 4
  }
  return out
}

/** Mean brightness change between neighboring columns (x) and rows (y). Grid lines show up as regular peaks. */
export function edgeProfiles(rgba: ArrayLike<number>, width: number, height: number): { x: Float64Array; y: Float64Array } {
  const lum = new Float32Array(width * height)
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.299 * (rgba[i * 4] ?? 0) + 0.587 * (rgba[i * 4 + 1] ?? 0) + 0.114 * (rgba[i * 4 + 2] ?? 0)
  }
  const x = new Float64Array(Math.max(0, width - 1))
  const y = new Float64Array(Math.max(0, height - 1))
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const v = lum[row * width + col] ?? 0
      if (col + 1 < width) x[col] = (x[col] ?? 0) + Math.abs((lum[row * width + col + 1] ?? 0) - v)
      if (row + 1 < height) y[row] = (y[row] ?? 0) + Math.abs((lum[(row + 1) * width + col] ?? 0) - v)
    }
  }
  return { x: smooth(x), y: smooth(y) }
}

/** Integer lags where the profile repeats (local autocorrelation maxima), with their strength. */
function periodCandidates(p: Float64Array): { lag: number; strength: number }[] {
  const n = p.length
  const maxLag = Math.min(MAX_CELL, Math.floor(n / MIN_CELLS_ACROSS))
  if (maxLag <= MIN_CELL + 1) return []
  let mean = 0
  for (const v of p) mean += v
  mean /= n
  const q = p.map((v) => v - mean)
  let denom = 0
  for (const v of q) denom += v * v
  if (denom === 0) return []

  const ac = new Float64Array(maxLag + 2)
  for (let k = 0; k <= maxLag + 1; k++) {
    let s = 0
    for (let i = 0; i + k < n; i++) s += (q[i] ?? 0) * (q[i + k] ?? 0)
    ac[k] = s / denom
  }
  // Only local maxima: right after lag 0 the curve is still falling and would win otherwise.
  const peaks: { lag: number; strength: number }[] = []
  for (let k = MIN_CELL; k <= maxLag; k++) {
    const v = ac[k] ?? 0
    if (v >= (ac[k - 1] ?? 0) && v >= (ac[k + 1] ?? 0)) peaks.push({ lag: k, strength: v })
  }
  return peaks
}

/**
 * Folds the profile every `period` px: at the true cell size all lines land on the same phase.
 * Score = mean profile value at the best phase relative to the overall mean.
 */
function fold(p: Float64Array, period: number): { phase: number; score: number } {
  let mean = 0
  for (const v of p) mean += v
  mean /= p.length || 1
  const folded: number[] = []
  for (let ph = 0; ph < period; ph += PHASE_STEP) {
    let sum = 0
    let count = 0
    for (let pos = ph; pos < p.length - 1; pos += period) {
      const i = Math.floor(pos)
      const f = pos - i
      sum += (p[i] ?? 0) * (1 - f) + (p[i + 1] ?? 0) * f
      count++
    }
    folded.push(count > 0 ? sum / count : 0)
  }
  const best = Math.max(...folded)
  // A line wider than 1 px leaves a flat, noisy top after smoothing, so the maximum alone can sit
  // at its edge. Use the centroid of the peak above half height (between median and maximum).
  const top = folded.indexOf(best)
  const m = folded.length
  const half = (best + ([...folded].sort((a, b) => a - b)[m >> 1] ?? 0)) / 2
  let weight = 0
  let moment = 0
  for (const dir of [-1, 1]) {
    for (let k = dir === 1 ? 0 : 1; k < m / 2; k++) {
      const v = (folded[(top + dir * k + m) % m] ?? 0) - half
      if (v <= 0) break
      weight += v
      moment += v * dir * k
    }
  }
  const center = top + (weight > 0 ? moment / weight : 0)
  const phase = (((center * PHASE_STEP) % period) + period) % period
  return { phase, score: mean > 0 ? best / mean : 0 }
}

/** Sharpest fold within ±range of `around`, searched in steps of `step` px. */
function refine(profiles: Float64Array[], around: number, range: number, step: number): number {
  let best = around
  let bestScore = -Infinity
  for (let period = around - range; period <= around + range; period += step) {
    if (period < MIN_CELL) continue
    const score = profiles.reduce((s, p) => s + fold(p, period).score, 0)
    if (score > bestScore) {
      bestScore = score
      best = period
    }
  }
  return best
}

/**
 * Cell size along one axis. Candidates come from the autocorrelation and are judged by how sharply
 * they fold. JPEG block edges (8/16 px) fold weakly and fail the absolute threshold. A half cell
 * folds clearly worse than its double (the true cell); the true cell folds about as sharply as its
 * double. Large periods fold sharper by chance (fewer samples), so each candidate is only compared
 * with its own double. Take the smallest candidate that passes both.
 */
function axisCell(p: Float64Array): number | null {
  const peaks = periodCandidates(p)
  const maxStrength = Math.max(0, ...peaks.map((c) => c.strength))
  const scored = peaks
    .filter((c) => c.strength >= 0.3 * maxStrength)
    .map((c) => {
      const period = refine([p], c.lag, 1, 0.02)
      return { period, sharpness: fold(p, period).score }
    })
    .sort((a, b) => a.period - b.period)
  const cell = scored.find((c) => {
    if (c.sharpness < MIN_SHARPNESS) return false
    const double = scored.find((d) => Math.abs(d.period - 2 * c.period) <= 2)
    return !double || c.sharpness >= 0.8 * double.sharpness
  })
  return cell?.period ?? null
}

export function detectGrid(rgba: ArrayLike<number>, width: number, height: number): Detection | null {
  const { x, y } = edgeProfiles(rgba, width, height)
  const cx = axisCell(x)
  const cy = axisCell(y)
  if (cx === null || cy === null) return null
  const rough = (cx + cy) / 2
  if (Math.abs(cx - cy) / rough > MAX_AXIS_DIFF) return null
  const size = refine([x, y], rough, 0.3, 0.01)
  // Profile index i is the edge between pixel i and i + 1, i.e. image coordinate i + 1.
  return { size, offsetX: fold(x, size).phase + 1, offsetY: fold(y, size).phase + 1 }
}

/** Detection in pixels of `region` drawn at `scale` px per plane unit, to size and offset in the plane. */
export function detectionToPlane(d: Detection, region: { x: number; y: number }, scale: number): Detection {
  return { size: d.size / scale, offsetX: region.x + d.offsetX / scale, offsetY: region.y + d.offsetY / scale }
}

/**
 * Detection in image pixels (of an image scaled by `imageScale`) to grid size and offset in scene
 * coordinates of the layer. Only meaningful for rotations in 90° steps.
 */
export function detectionToScene(
  d: Detection,
  layer: Layer,
  imageScale: number
): { size: number; offsetX: number; offsetY: number } {
  const lx = (d.offsetX / imageScale - layer.width / 2) * layer.scale
  const ly = (d.offsetY / imageScale - layer.height / 2) * layer.scale
  const rad = (layer.rotation * Math.PI) / 180
  const cos = Math.round(Math.cos(rad))
  const sin = Math.round(Math.sin(rad))
  return {
    size: (d.size / imageScale) * layer.scale,
    offsetX: layer.x + lx * cos - ly * sin,
    offsetY: layer.y + lx * sin + ly * cos
  }
}
