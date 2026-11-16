import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_GRID, type Layer, type LocalGrid, type Scene } from '../../shared/types.ts'
import { areaGeometry, cellSizeAt, frameAt, fromLayer, snapToken, toLayer } from './frames.ts'

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)

const local: LocalGrid = {
  ...DEFAULT_GRID,
  id: 'g1',
  size: 20,
  rotation: 90,
  // Turned 90°: plane x runs along the layer's y axis, plane y along its negative x.
  region: { x: 0, y: -100, width: 100, height: 100 },
  visible: true
}
const layer: Layer = {
  id: 'l1',
  kind: 'maps',
  name: 'map.png',
  width: 200,
  height: 100,
  x: 1000,
  y: 500,
  scale: 2,
  rotation: 30,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity: 1,
  blend: 'normal',
  visible: true,
  locked: true,
  grids: [local],
  areas: []
}
const scene: Scene = {
  id: 's',
  name: 's',
  layers: [layer],
  grid: { ...DEFAULT_GRID, size: 50 },
  tokens: [],
  fog: null,
  rooms: [],
  view: null
}

test('layer px round-trip through scene coordinates', () => {
  const p = fromLayer(layer, { x: 37, y: 81 })
  const q = toLayer(layer, p)
  near(q.x, 37)
  near(q.y, 81)
  // The layer center is its position.
  const c = fromLayer(layer, { x: 100, y: 50 })
  near(c.x, 1000)
  near(c.y, 500)
})

test('the local grid applies inside its region, the scene grid elsewhere', () => {
  const inside = fromLayer(layer, { x: 50, y: 50 })
  assert.equal(frameAt(scene, inside).grid, local)
  near(cellSizeAt(scene, inside), 40)
  const outside = fromLayer(layer, { x: 150, y: 50 })
  assert.equal(frameAt(scene, outside).grid, scene.grid)
  assert.equal(frameAt(scene, { x: -5000, y: 0 }).grid, scene.grid)
})

test('tokens snap to local cell centers, back in scene coordinates', () => {
  const p = snapToken(scene, fromLayer(layer, { x: 52, y: 47 }), 1)
  const q = toLayer(layer, p)
  // Cell centers of a 20 px grid in the turned plane are at odd multiples of 10 in layer px too.
  near(q.x, 50)
  near(q.y, 50)
})

test('area on a local grid: 10 ft burst covers 12 cells, measured in local cells', () => {
  const area = { id: 'a', shape: 'burst' as const, x: 40, y: 40, tx: 40, ty: 80, size: 1, visible: true }
  const g = areaGeometry(scene, layer, area)
  assert.equal(g.feet, 10)
  assert.equal(g.cells.length, 12)
})

test('burst started on a 2×2 token counts from the edge of its space', () => {
  const area = { id: 'b', shape: 'burst' as const, x: -5000, y: 100, tx: -5000, ty: 200, size: 2, visible: true }
  const g = areaGeometry(scene, null, area)
  assert.equal(g.feet, 5)
  assert.equal(g.cells.length, 16)
})
