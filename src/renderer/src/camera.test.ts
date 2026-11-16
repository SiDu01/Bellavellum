import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Layer } from '../../shared/types.ts'
import { fitCamera, layerBounds, sceneBounds, screenToWorld, visibleRect, zoomAt } from './camera.ts'

const base: Layer = {
  id: 'l',
  kind: 'maps',
  name: 'm.png',
  width: 200,
  height: 100,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity: 1,
  blend: 'normal',
  visible: true,
  locked: false,
  grids: [],
  areas: []
}

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('fitCamera fits the rect into the screen', () => {
  assert.deepEqual(fitCamera({ x: 0, y: 0, width: 200, height: 100 }, 1000, 1000), { x: 100, y: 50, zoom: 5 })
})

test('visibleRect is the inverse of fitCamera for matching aspect', () => {
  const rect = { x: -50, y: 10, width: 400, height: 300 }
  assert.deepEqual(visibleRect(fitCamera(rect, 800, 600), 800, 600), rect)
})

test('screenToWorld maps the stage center to the camera point', () => {
  assert.deepEqual(screenToWorld({ x: 10, y: 20, zoom: 2 }, 500, 400, 1000, 800), { x: 10, y: 20 })
  assert.deepEqual(screenToWorld({ x: 10, y: 20, zoom: 2 }, 600, 400, 1000, 800), { x: 60, y: 20 })
})

test('zoomAt keeps the point under the cursor', () => {
  const cam = { x: 10, y: 20, zoom: 2 }
  const next = zoomAt(cam, 1.5, 700, 100, 1000, 800)
  const before = { x: cam.x + (700 - 500) / cam.zoom, y: cam.y + (100 - 400) / cam.zoom }
  near(next.x + (700 - 500) / next.zoom, before.x)
  near(next.y + (100 - 400) / next.zoom, before.y)
  near(next.zoom, 3)
})

test('layerBounds handles scale, crop and rotation', () => {
  assert.deepEqual(layerBounds({ ...base, x: 100, y: 50, scale: 2 }), { x: -100, y: -50, width: 400, height: 200 })
  assert.deepEqual(layerBounds({ ...base, crop: { top: 0, right: 0.5, bottom: 0, left: 0 } }), {
    x: -100,
    y: -50,
    width: 100,
    height: 100
  })
  const rotated = layerBounds({ ...base, rotation: 90 })
  near(rotated.width, 100)
  near(rotated.height, 200)
})

test('sceneBounds ignores hidden layers', () => {
  assert.equal(sceneBounds([{ ...base, visible: false }]), null)
  assert.deepEqual(sceneBounds([base, { ...base, x: 300, visible: true }, { ...base, x: 5000, visible: false }]), {
    x: -100,
    y: -50,
    width: 500,
    height: 100
  })
})
