import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_GRID, type Room } from '../../shared/types.ts'
import { addSquare, addSquares, cellAt, cellsInRect, eraseAt, eraseRect, roomAt, roomBounds } from './rooms.ts'

const grid = { ...DEFAULT_GRID, size: 50, offsetX: 10, offsetY: 20 }
const empty: Room = { id: 'r', name: 'Halle', color: '#33aa66', squares: [] }

test('cellAt snaps to the grid cell under the point', () => {
  assert.deepEqual(cellAt(grid, 12, 22), [10, 20, 50])
  assert.deepEqual(cellAt(grid, 59.9, 69.9), [10, 20, 50])
  assert.deepEqual(cellAt(grid, 60, 70), [60, 70, 50])
  assert.deepEqual(cellAt(grid, -1, 0), [-40, -30, 50])
})

test('addSquare ignores cells already painted', () => {
  const a = addSquare(empty, [10, 20, 50])
  const b = addSquare(a, [10, 20, 50])
  assert.equal(b, a)
  assert.equal(addSquare(b, [60, 20, 50]).squares.length, 2)
})

test('eraseAt removes squares of any size under the point', () => {
  const room = { ...empty, squares: [[10, 20, 50], [60, 20, 50], [0, 0, 100]] as [number, number, number][] }
  assert.deepEqual(eraseAt(room, 30, 40).squares, [[60, 20, 50]])
  assert.equal(eraseAt(room, 500, 500), room)
})

test('cellsInRect takes every cell the rectangle touches', () => {
  // Cells start at 10/60/110 and 20/70/120: a rect from 30 to 100 touches two columns and two rows.
  assert.deepEqual(cellsInRect(grid, { x: 30, y: 40, width: 70, height: 60 }), [
    [10, 20, 50],
    [60, 20, 50],
    [10, 70, 50],
    [60, 70, 50]
  ])
  // A small rect over a cell corner takes all four cells around it.
  assert.deepEqual(cellsInRect(grid, { x: 55, y: 65, width: 10, height: 10 }), [
    [10, 20, 50],
    [60, 20, 50],
    [10, 70, 50],
    [60, 70, 50]
  ])
  // A click (empty rect) takes the cell under it; ending exactly on a cell edge does not take the next cell.
  assert.deepEqual(cellsInRect(grid, { x: 40, y: 50, width: 0, height: 0 }), [[10, 20, 50]])
  assert.deepEqual(cellsInRect(grid, { x: 10, y: 20, width: 50, height: 50 }), [[10, 20, 50]])
})

test('addSquares skips duplicates, eraseRect removes every touched square', () => {
  const a = addSquares(empty, [[10, 20, 50], [10, 20, 50], [60, 20, 50]])
  assert.equal(a.squares.length, 2)
  assert.equal(addSquares(a, [[10, 20, 50]]), a)
  assert.deepEqual(eraseRect(a, { x: 0, y: 0, width: 50, height: 50 }).squares, [[60, 20, 50]])
  assert.deepEqual(eraseRect(a, { x: 55, y: 25, width: 10, height: 10 }).squares, [])
  assert.equal(eraseRect(a, { x: 500, y: 500, width: 1, height: 1 }), a)
})

test('roomAt finds the topmost room under the point', () => {
  const a = { ...empty, id: 'a', squares: [[0, 0, 100]] as [number, number, number][] }
  const b = { ...empty, id: 'b', squares: [[50, 50, 50]] as [number, number, number][] }
  assert.equal(roomAt([a, b], 60, 60)?.id, 'b')
  assert.equal(roomAt([a, b], 10, 10)?.id, 'a')
  assert.equal(roomAt([a, b], 200, 10), null)
})

test('roomBounds covers all squares', () => {
  assert.equal(roomBounds(empty), null)
  assert.deepEqual(roomBounds({ ...empty, squares: [[10, 20, 50], [110, 70, 50]] }), { x: 10, y: 20, width: 150, height: 100 })
})
