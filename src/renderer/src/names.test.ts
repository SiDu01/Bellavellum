import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanName, nameProblem, splitExt } from './names.ts'

test('cleanName turns download names into readable ones', () => {
  assert.equal(cleanName('Roll20-50x50-desert-ziggurat-1st-floor'), 'Desert Ziggurat 1st Floor')
  assert.equal(cleanName('50x50-sewers-hideouts-2'), 'Sewers Hideouts 2')
  assert.equal(cleanName('Grand-Halls-Throne-Room'), 'Grand Halls Throne Room')
  assert.equal(cleanName('mage_tower__map'), 'Mage Tower Map')
  assert.equal(cleanName('Mountain-Keep-Summer (1)'), 'Mountain Keep Summer (1)')
  assert.equal(cleanName('50x50'), '50x50')
})

test('nameProblem flags names Windows cannot store', () => {
  assert.equal(nameProblem('Höhle 1.png'), null)
  for (const bad of ['', ' ', 'a/b', 'a:b', 'a?', 'end.', 'end ', '..']) assert.notEqual(nameProblem(bad), null, bad)
})

test('splitExt keeps dot files whole', () => {
  assert.deepEqual(splitExt('map.final.png'), ['map.final', '.png'])
  assert.deepEqual(splitExt('.hidden'), ['.hidden', ''])
})
