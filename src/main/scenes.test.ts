import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Layer, Scene } from '../shared/types.ts'
import { deleteScene, isScene, listScenes, loadScene, saveScene } from './scenes.ts'

const layer: Layer = {
  id: 'l1',
  kind: 'maps',
  name: 'cave.png',
  width: 100,
  height: 50,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity: 1,
  blend: 'normal',
  visible: true
}
const scene: Scene = { id: 'abc-123', name: 'Höhle', layers: [layer], view: null }

function withTemp(fn: (root: string) => Promise<void>): () => Promise<void> {
  return async () => {
    const root = mkdtempSync(join(tmpdir(), 'bv-scene-'))
    try {
      await fn(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

test('isScene checks the shape', () => {
  assert.ok(isScene(scene))
  assert.ok(isScene({ ...scene, view: { x: 0, y: 0, width: 10, height: 10 } }))
  assert.ok(!isScene({ ...scene, id: '../evil' }))
  assert.ok(!isScene({ ...scene, layers: [{ ...layer, blend: 'dissolve' }] }))
  assert.ok(!isScene({ ...scene, layers: [{ ...layer, x: Number.NaN }] }))
  assert.ok(!isScene({ ...scene, layers: [{ ...layer, kind: 'music' }] }))
  assert.ok(!isScene({ ...scene, view: { x: 0 } }))
})

test(
  'save, load, list and delete',
  withTemp(async (data) => {
    await saveScene(data, scene)
    await saveScene(data, { ...scene, name: 'Höhle 2' })
    assert.deepEqual(await loadScene(data, 'abc-123'), { ...scene, name: 'Höhle 2' })
    assert.ok(!existsSync(join(data, 'scenes', 'abc-123.json.tmp')))

    writeFileSync(join(data, 'scenes', 'broken.json'), '{ nope')
    assert.deepEqual(await listScenes(data), { scenes: [{ id: 'abc-123', name: 'Höhle 2' }], broken: ['broken.json'] })

    await deleteScene(data, 'abc-123')
    assert.ok(existsSync(join(data, 'trash', 'scenes', 'abc-123.json')))
    assert.deepEqual((await listScenes(data)).scenes, [])
  })
)

test(
  'rejects invalid input',
  withTemp(async (data) => {
    mkdirSync(join(data, 'scenes'))
    await assert.rejects(saveScene(data, { ...scene, layers: 'x' }))
    await assert.rejects(loadScene(data, '../../secret'))
    await assert.rejects(deleteScene(data, '..\\x'))
    writeFileSync(join(data, 'scenes', 'other.json'), JSON.stringify(scene))
    await assert.rejects(loadScene(data, 'other'), /beschädigt/)
  })
)
