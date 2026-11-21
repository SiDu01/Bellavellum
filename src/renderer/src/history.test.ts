import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_GRID, type Scene } from '../../shared/types.ts'
import { emptyHistory, mapHistory, MAX_STEPS, MERGE_MS, record, redo, undo } from './history.ts'

const scene = (name: string, fog: Scene['fog'] = null): Scene => ({
  id: 's',
  name,
  layers: [],
  grid: DEFAULT_GRID,
  tokens: [],
  fog,
  rooms: [],
  view: null
})

test('undo and redo walk the recorded steps; a new edit drops the redo steps', () => {
  let h = record(emptyHistory, scene('a'), 1000)
  h = record(h, scene('b'), 2000)
  const u1 = undo(h, scene('c'))
  assert.equal(u1?.scene.name, 'b')
  const u2 = u1 && undo(u1.history, u1.scene)
  assert.equal(u2?.scene.name, 'a')
  assert.equal(u2 && undo(u2.history, u2.scene), null)
  const r1 = u2 && redo(u2.history, u2.scene)
  assert.equal(r1?.scene.name, 'b')
  // An edit right after an undo is a step of its own, and the redo steps are gone.
  const edited = r1 && record(r1.history, r1.scene, 2100)
  assert.equal(edited && redo(edited, scene('x')), null)
  assert.equal(edited?.past.length, 2)
})

test('edits close together merge into one step', () => {
  let h = record(emptyHistory, scene('a'), 1000)
  h = record(h, scene('a1'), 1000 + MERGE_MS - 1)
  h = record(h, scene('a2'), 1000 + 2 * MERGE_MS - 2)
  assert.deepEqual(h.past.map((s) => s.name), ['a'])
  h = record(h, scene('b'), 5000)
  assert.deepEqual(h.past.map((s) => s.name), ['a', 'b'])
})

test('history is capped', () => {
  let h = emptyHistory
  for (let i = 0; i < MAX_STEPS + 5; i++) h = record(h, scene(String(i)), i * 1000 + 1000)
  assert.equal(h.past.length, MAX_STEPS)
  assert.equal(h.past[0]?.name, '5')
})

test('undo keeps the current fog mask and only restores fog on or off', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 }
  const before = scene('a', { enabled: false, rect, revision: 1 })
  const current = scene('b', { enabled: true, rect: { ...rect, width: 20 }, revision: 4 })
  const result = undo(record(emptyHistory, before, 1000), current)
  assert.deepEqual(result?.scene.fog, { enabled: false, rect: { ...rect, width: 20 }, revision: 4 })
  // Undoing the creation of fog leaves the mask alone.
  assert.deepEqual(undo(record(emptyHistory, scene('a'), 1000), current)?.scene.fog, current.fog)
})

test('mapHistory rewrites past and future', () => {
  const h = mapHistory({ past: [scene('a')], future: [scene('b')], last: 0 }, (s) => ({ ...s, name: s.name + '!' }))
  assert.deepEqual([h.past[0]?.name, h.future[0]?.name], ['a!', 'b!'])
})
