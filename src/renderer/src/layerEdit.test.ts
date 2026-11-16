import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Layer } from '../../shared/types.ts'
import { cropBetween, evenCuts, splitLayer } from './layerEdit.ts'

const layer: Layer = {
  id: 'l1',
  kind: 'maps',
  name: 'map.png',
  width: 200,
  height: 100,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  crop: { top: 0, right: 0.5, bottom: 0, left: 0 },
  opacity: 1,
  blend: 'normal',
  visible: true,
  locked: false,
  grids: [],
  areas: [{ id: 'a', shape: 'burst', x: 90, y: 90, tx: 90, ty: 90, size: 1, visible: true }]
}

test('cropBetween keeps the dragged rectangle, in any drag direction', () => {
  assert.deepEqual(cropBetween(layer, { x: 150, y: 75 }, { x: 50, y: 25 }), { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25 })
  assert.equal(cropBetween(layer, { x: 50, y: 25 }, { x: 50.5, y: 90 }), null)
})

test('2×2 split of a cropped layer tiles exactly its visible part', () => {
  const parts = splitLayer(layer, evenCuts(0, 0.5, 2), evenCuts(0, 1, 2))
  assert.equal(parts.length, 4)
  assert.equal(parts[0]?.id, 'l1')
  assert.deepEqual(parts[3]?.crop, { left: 0.25, right: 0.5, top: 0.5, bottom: 0 })
  // Origin (90, 90) is in the bottom-right part.
  assert.deepEqual(parts.map((p) => p.areas.length), [0, 0, 0, 1])
})

test('cuts outside the visible part are ignored', () => {
  assert.equal(splitLayer(layer, [0.75], []).length, 1)
})
