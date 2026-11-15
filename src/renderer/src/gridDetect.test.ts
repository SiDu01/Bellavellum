import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Layer } from '../../shared/types.ts'
import { detectGrid, detectionToScene, type Detection } from './gridDetect.ts'

/** Noisy RGBA image with 2 px dark lines every `cellX`/`cellY` px, centered on `ox`/`oy`. */
function image(width: number, height: number, cellX: number, cellY: number, ox: number, oy: number, seed = 1): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  let s = seed
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const onLine = (v: number, o: number, c: number) => {
    if (c <= 0) return false
    // Pixel v covers [v, v + 1]; the line covers [o - 1, o + 1].
    const d = (((v - o) % c) + c) % c
    return d < 1 || d >= c - 1
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const line = onLine(x, ox, cellX) || onLine(y, oy, cellY)
      const v = line ? 40 + rand() * 20 : 150 + rand() * 80
      data.set([v, v * 0.9, v * 0.8, 255], (y * width + x) * 4)
    }
  }
  return data
}

const near = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`)
/** Offsets are equivalent modulo the cell size. */
const nearMod = (a: number, b: number, cell: number, eps: number, what: string) => {
  const d = Math.abs((((a - b) % cell) + cell + cell / 2) % cell - cell / 2)
  assert.ok(d <= eps, `${what}: ${a} vs ${b} (mod ${cell})`)
}

test('finds a square grid with fractional cell size and offset', () => {
  const d = detectGrid(image(600, 420, 23.5, 23.5, 7, 12), 600, 420)
  assert.ok(d, 'no grid found')
  near(d.size, 23.5, 0.1, 'size')
  nearMod(d.offsetX, 7, 23.5, 1, 'offsetX')
  nearMod(d.offsetY, 12, 23.5, 1, 'offsetY')
})

test('finds a coarse grid', () => {
  const d = detectGrid(image(1000, 900, 70, 70, 30, 5), 1000, 900)
  assert.ok(d)
  near(d.size, 70, 0.2, 'size')
  // Line pixels 29 and 30 / 4 and 5: centers at exactly 30.0 and 5.0.
  nearMod(d.offsetX, 30, 70, 0.3, 'offsetX')
  nearMod(d.offsetY, 5, 70, 0.3, 'offsetY')
})

test('no grid when fewer than 10 cells fit across', () => {
  assert.equal(detectGrid(image(600, 600, 80, 80, 10, 10), 600, 600), null)
})

test('no grid in pure noise', () => {
  assert.equal(detectGrid(image(500, 400, 0, 0, 0, 0), 500, 400), null)
})

test('no square grid when the axes disagree', () => {
  assert.equal(detectGrid(image(600, 600, 24, 30, 0, 0), 600, 600), null)
})

const layer: Layer = {
  id: 'l',
  kind: 'maps',
  name: 'm.png',
  width: 200,
  height: 100,
  x: 100,
  y: 50,
  scale: 2,
  rotation: 0,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity: 1,
  blend: 'normal',
  visible: true,
  locked: false
}
const det: Detection = { size: 10, offsetX: 3, offsetY: 4 }

test('detectionToScene applies position and scale', () => {
  assert.deepEqual(detectionToScene(det, layer, 1), { size: 20, offsetX: -94, offsetY: -42 })
})

test('detectionToScene undoes the analysis downscale', () => {
  assert.deepEqual(detectionToScene({ ...det, size: 5, offsetX: 1.5, offsetY: 2 }, layer, 0.5), {
    size: 20,
    offsetX: -94,
    offsetY: -42
  })
})

test('detectionToScene follows 90° rotation', () => {
  // Corner (3, 4) is (-97, -46) from the center, rotated 90° -> (46, -97), times scale 2.
  assert.deepEqual(detectionToScene(det, { ...layer, rotation: 90 }, 1), { size: 20, offsetX: 192, offsetY: -144 })
})
