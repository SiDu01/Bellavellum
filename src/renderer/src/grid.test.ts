import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_GRID, type Grid } from '../../shared/types.ts'
import { calibrate, hexRadius, normalizeRect, snap } from './grid.ts'

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
const square: Grid = { ...DEFAULT_GRID, size: 50, offsetX: 10, offsetY: 20 }

test('square snap: 1-cell token goes to the cell center', () => {
  assert.deepEqual(snap(square, 12, 22, 1), { x: 35, y: 45 })
  assert.deepEqual(snap(square, 59, 69, 1), { x: 35, y: 45 })
  assert.deepEqual(snap(square, 61, 71, 1), { x: 85, y: 95 })
  // -100 lies in the cells [-140, -90] and [-130, -80].
  assert.deepEqual(snap(square, -100, -100, 1), { x: -115, y: -105 })
})

test('square snap: 2-cell token centers on a grid intersection', () => {
  assert.deepEqual(snap(square, 64, 74, 2), { x: 60, y: 70 })
})

for (const type of ['hex-pointy', 'hex-flat'] as const) {
  const hex: Grid = { ...DEFAULT_GRID, type, size: 60, offsetX: 100, offsetY: 200 }
  const r = hexRadius(60)

  test(`${type}: offset is a cell center and nearby points snap to it`, () => {
    assert.deepEqual(snap(hex, 100, 200, 1), { x: 100, y: 200 })
    const p = snap(hex, 100 + r * 0.5, 200 - r * 0.4, 1)
    near(p.x, 100)
    near(p.y, 200)
  })

  test(`${type}: neighbors are size apart along the flat-side axis`, () => {
    const p = type === 'hex-pointy' ? snap(hex, 100 + 58, 200, 1) : snap(hex, 100, 200 + 58, 1)
    near(type === 'hex-pointy' ? p.x : p.y, (type === 'hex-pointy' ? 100 : 200) + 60)
  })

  test(`${type}: next row is offset by half a cell`, () => {
    const p = type === 'hex-pointy' ? snap(hex, 130, 200 + 1.5 * r, 1) : snap(hex, 100 + 1.5 * r, 230, 1)
    near(p.x, type === 'hex-pointy' ? 130 : 100 + 1.5 * r)
    near(p.y, type === 'hex-pointy' ? 200 + 1.5 * r : 230)
  })
}

test('calibrate square from a drag over 4 cells', () => {
  assert.deepEqual(calibrate(DEFAULT_GRID, { x: 5, y: 7, width: 200, height: 204 }, 4), {
    ...DEFAULT_GRID,
    size: 50.5,
    offsetX: 5,
    offsetY: 7
  })
})

test('calibrate hex from a drag over 3 cells in a row', () => {
  const pointy = calibrate({ ...DEFAULT_GRID, type: 'hex-pointy' }, { x: 0, y: 0, width: 180, height: 70 }, 3)
  assert.equal(pointy.size, 60)
  assert.deepEqual([pointy.offsetX, pointy.offsetY], [30, 35])
  const flat = calibrate({ ...DEFAULT_GRID, type: 'hex-flat' }, { x: 0, y: 0, width: 70, height: 180 }, 3)
  assert.equal(flat.size, 60)
  assert.deepEqual([flat.offsetX, flat.offsetY], [35, 30])
})

test('normalizeRect handles drags in any direction', () => {
  assert.deepEqual(normalizeRect(10, 50, 0, 20), { x: 0, y: 20, width: 10, height: 30 })
})
