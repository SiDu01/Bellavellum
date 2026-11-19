import { test } from 'node:test'
import assert from 'node:assert/strict'
import { burstCells, coneCells, emanationCells, lineCells, snapLike, snapOrigin, squares } from './areas.ts'

const corner = { x: 0, y: 0 }
const center = { x: 0.5, y: 0.5 }

test('5-10-5 diagonal counting', () => {
  assert.equal(squares(3, 0), 3)
  assert.equal(squares(1, 1), 1)
  assert.equal(squares(2, 2), 3)
  assert.equal(squares(-4, 4), 6)
})

test('origin snaps to the nearer of intersection and cell center', () => {
  assert.deepEqual(snapOrigin({ x: 2.1, y: 2.9 }), { x: 2, y: 3 })
  assert.deepEqual(snapOrigin({ x: 2.4, y: 2.6 }), { x: 2.5, y: 2.5 })
  assert.deepEqual(snapLike(center, { x: 3.9, y: 0.1 }), { x: 3.5, y: 0.5 })
  assert.deepEqual(snapLike(corner, { x: 3.9, y: 0.1 }), { x: 4, y: 0 })
})

test('burst from an intersection: 5 ft is 2×2, 10 ft is 4×4 without corners', () => {
  assert.deepEqual(burstCells(corner, 1).sort(), [[-1, -1], [-1, 0], [0, -1], [0, 0]])
  const ten = burstCells({ x: 5, y: 5 }, 2)
  assert.equal(ten.length, 12)
  assert.ok(!ten.some(([i, j]) => i === 3 && j === 3))
})

test('burst from a cell: 5 ft is 3×3, 10 ft is 5×5 without corners', () => {
  assert.equal(burstCells(center, 1).length, 9)
  assert.equal(burstCells(center, 2).length, 21)
})

test('emanation around a 2×2 creature: 5 ft is 4×4', () => {
  assert.equal(emanationCells(0, 0, 2, 1).length, 16)
})

/** Cells per row of an upward cone, nearest row first. */
function rowWidths(cells: [number, number][]): number[] {
  const rows = new Map<number, number>()
  for (const [, j] of cells) rows.set(j, (rows.get(j) ?? 0) + 1)
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, n]) => n)
}
const UP = -Math.PI / 2
const UP_RIGHT = -Math.PI / 4

// Expected rows read off the PF2e Core Rulebook cone templates.
test('cone straight from a cell leaves through its edge: 15 ft is 1, 3, 3', () => {
  assert.deepEqual(rowWidths(coneCells(center, UP, 3)), [1, 3, 3])
  assert.deepEqual(coneCells(center, UP, 1), [[0, -1]])
})

test('cone straight from an intersection: 30 ft and 60 ft templates', () => {
  assert.deepEqual(rowWidths(coneCells(corner, UP, 6)), [2, 4, 6, 8, 6, 2])
  assert.deepEqual(rowWidths(coneCells(corner, UP, 12)), [2, 4, 6, 8, 10, 12, 14, 16, 14, 10, 6, 2])
})

test('cone diagonal: 15, 30 and 60 ft templates, from a cell the same as from its corner', () => {
  assert.deepEqual(rowWidths(coneCells(corner, UP_RIGHT, 3)), [3, 2, 1])
  assert.deepEqual(rowWidths(coneCells(corner, UP_RIGHT, 6)), [6, 5, 5, 4, 3, 1])
  assert.deepEqual(rowWidths(coneCells(corner, UP_RIGHT, 12)), [12, 11, 11, 10, 10, 9, 9, 8, 7, 5, 3, 1])
  assert.ok(coneCells(corner, UP_RIGHT, 3).every(([i, j]) => i >= 0 && j < 0))
  assert.deepEqual(coneCells(center, UP_RIGHT, 6).sort(), coneCells({ x: 1, y: 0 }, UP_RIGHT, 6).sort())
})

const toward = (x: number, y: number) => Math.atan2(y, x)
/** Cells per row, top row first. */
const rows = (cells: [number, number][]) => {
  const by = new Map<number, number[]>()
  for (const [i, j] of cells) by.set(j, [...(by.get(j) ?? []), i])
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([, is]) => is.sort((a, b) => a - b))
}

// Expected cells read off the PF2e Core Rulebook line templates (origin: a grid intersection).
test('line 30 ft: straight, 1:2, 1:3 and diagonal templates', () => {
  assert.deepEqual(rows(lineCells(corner, 0, 6)), [[0, 1, 2, 3, 4, 5]])
  assert.deepEqual(rows(lineCells(corner, toward(2, 1), 6)), [[0, 1], [2, 3], [4]])
  assert.deepEqual(rows(lineCells(corner, toward(3, 1), 6)), [[0, 1, 2], [3, 4, 5]])
  assert.deepEqual(rows(lineCells(corner, toward(1, 1), 6)), [[0], [1], [2], [3]])
})

test('line 60 ft: straight, 1:3, 1:2 and diagonal templates', () => {
  assert.equal(lineCells(corner, 0, 12).length, 12)
  assert.deepEqual(rows(lineCells(corner, toward(3, 1), 12)), [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10]])
  assert.deepEqual(rows(lineCells(corner, toward(2, 1), 12)), [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]])
  assert.equal(lineCells(corner, toward(1, 1), 12).length, 8)
})

test('line mirrors with its direction: up and to the left', () => {
  assert.deepEqual(rows(lineCells(corner, toward(2, -1), 6)), [[4], [2, 3], [0, 1]])
  assert.deepEqual(lineCells(corner, toward(-1, 0), 6).sort(), [[-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0], [-6, 0]].sort())
})

test('line from a cell: starts next to the caster, 30 ft is 6 straight, 4 diagonal', () => {
  assert.deepEqual(lineCells(center, 0, 6).sort(), [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]])
  assert.deepEqual(lineCells(center, Math.PI / 4, 6).sort(), [[1, 1], [2, 2], [3, 3], [4, 4]])
})
