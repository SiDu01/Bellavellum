import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_GRID } from '../../shared/types.ts'
import { cellsInPolygon, insidePolygon, pickFloor, type Rgb } from './wand.ts'

const grid = { ...DEFAULT_GRID, size: 10, offsetX: 0, offsetY: 0 }

test('insidePolygon and cellsInPolygon use cell centers', () => {
  const tri = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 0, y: 40 }
  ]
  assert.ok(insidePolygon(tri, 5, 5))
  assert.ok(!insidePolygon(tri, 35, 35))
  // Centers (5,5) (15,5) (25,5) (5,15) (15,15) (5,25) are below the diagonal x + y = 40.
  assert.equal(cellsInPolygon(grid, tri).length, 6)
  assert.deepEqual(cellsInPolygon(grid, tri.slice(0, 2)), [])
})

test('pickFloor keeps the floor and what it encloses, drops walls and strays', () => {
  const floor: Rgb = [180, 150, 100]
  const wall: Rgb = [20, 20, 20]
  const table: Rgb = [90, 40, 10]
  // 7x7 outline: wall ring, 5x5 floor with a table in the middle, and a stray floor-colored cell in the wall.
  const cells: [number, number, number][] = []
  const colors: Rgb[] = []
  for (let j = 0; j < 7; j++) {
    for (let i = 0; i < 7; i++) {
      cells.push([i * 10, j * 10, 10])
      const ring = i === 0 || j === 0 || i === 6 || j === 6
      colors.push(i === 0 && j === 0 ? floor : ring ? wall : i === 3 && j === 3 ? table : floor)
    }
  }
  const picked = pickFloor(cells, colors, 40)
  assert.equal(picked.length, 25)
  assert.ok(picked.some(([x, y]) => x === 30 && y === 30), 'table cell is enclosed')
  assert.ok(!picked.some(([x, y]) => x === 0 && y === 0), 'stray cell in the wall is dropped')
  assert.deepEqual(pickFloor([], [], 40), [])
})
