import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_GRID, type Layer, type Scene, type Token } from '../shared/types.ts'
import { deleteScene, isScene, listScenes, loadScene, saveFog, saveScene } from './scenes.ts'

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
const token: Token = { id: 't1', kind: 'tokens', name: 'orc.png', x: 50, y: 50, cells: 1, label: 'Ork', visible: true }
const scene: Scene = {
  id: 'abc-123',
  name: 'Höhle',
  layers: [layer],
  grid: DEFAULT_GRID,
  tokens: [token],
  fog: null,
  rooms: [{ id: 'r1', name: 'Halle', color: '#33aa66', squares: [[0, 0, 50], [50, 0, 50]] }],
  view: null
}
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

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
  assert.ok(!isScene({ ...scene, grid: { ...DEFAULT_GRID, size: 0 } }))
  assert.ok(!isScene({ ...scene, grid: { ...DEFAULT_GRID, type: 'triangle' } }))
  assert.ok(!isScene({ ...scene, grid: { ...DEFAULT_GRID, color: 'red"/><script>' } }))
  assert.ok(!isScene({ ...scene, tokens: [{ ...token, cells: -1 }] }))
  const fog = { enabled: true, rect: { x: 0, y: 0, width: 10, height: 10 }, revision: 3 }
  assert.ok(isScene({ ...scene, fog }))
  assert.ok(!isScene({ ...scene, fog: { ...fog, rect: { x: 0, y: 0, width: 0, height: 10 } } }))
  assert.ok(!isScene({ ...scene, fog: { ...fog, enabled: 'yes' } }))
  const room = scene.rooms[0]
  assert.ok(room)
  assert.ok(!isScene({ ...scene, rooms: [{ ...room, color: 'blue' }] }))
  assert.ok(!isScene({ ...scene, rooms: [{ ...room, squares: [[0, 0, 0]] }] }))
  assert.ok(!isScene({ ...scene, rooms: [{ ...room, squares: [[0, 0]] }] }))
  assert.ok(!isScene({ ...scene, rooms: 'none' }))
})

test(
  'fog mask is saved next to the scene and trashed with it',
  withTemp(async (data) => {
    await saveScene(data, scene)
    await saveFog(data, 'abc-123', png)
    assert.deepEqual(new Uint8Array(readFileSync(join(data, 'scenes', 'abc-123.fog.png'))), png)
    await assert.rejects(saveFog(data, 'abc-123', new Uint8Array([1, 2, 3])), /PNG/)
    await assert.rejects(saveFog(data, '../x', png))
    await deleteScene(data, 'abc-123')
    assert.ok(existsSync(join(data, 'trash', 'scenes', 'abc-123.fog.png')))
    assert.ok(!existsSync(join(data, 'scenes', 'abc-123.fog.png')))
  })
)

test(
  'scenes saved before grid and tokens existed load with defaults',
  withTemp(async (data) => {
    mkdirSync(join(data, 'scenes'))
    const { grid: _grid, tokens: _tokens, fog: _fog, rooms: _rooms, ...old } = scene
    writeFileSync(join(data, 'scenes', 'abc-123.json'), JSON.stringify({ ...old, grid: { size: 42 } }))
    const loaded = await loadScene(data, 'abc-123')
    assert.deepEqual(loaded.grid, { ...DEFAULT_GRID, size: 42 })
    assert.deepEqual(loaded.tokens, [])
    assert.equal(loaded.fog, null)
    assert.deepEqual(loaded.rooms, [])
  })
)

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
