import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskScale, maskSize, toMask } from './fog.ts'

test('small scenes keep 1 mask px per scene unit', () => {
  const rect = { x: -500, y: -350, width: 1000, height: 700 }
  assert.equal(maskScale(rect), 1)
  assert.deepEqual(maskSize(rect), { width: 1000, height: 700 })
  assert.deepEqual(toMask(rect, -500, -350), { x: 0, y: 0 })
  assert.deepEqual(toMask(rect, 0, 0), { x: 500, y: 350 })
})

test('large scenes are capped at 2048 px on the long side', () => {
  const rect = { x: 0, y: 0, width: 8192, height: 4096 }
  assert.deepEqual(maskSize(rect), { width: 2048, height: 1024 })
  assert.deepEqual(toMask(rect, 4096, 4096), { x: 1024, y: 1024 })
})
