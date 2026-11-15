import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_GRID, type Room } from '../../shared/types.ts'
import { addSquare, cellAt, eraseAt, roomAt, roomBounds } from './rooms.ts'

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
