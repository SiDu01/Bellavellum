import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DisplayInfo } from '../shared/types.ts'
import { findDisplay, loadPlayerDisplay, savePlayerDisplay } from './displays.ts'

const main: DisplayInfo = { id: 1, label: 'Laptop', width: 1920, height: 1200, primary: true, player: false }
const tv: DisplayInfo = { id: 2, label: 'LG TV', width: 3840, height: 2160, primary: false, player: false }

test('findDisplay matches by id, then by label and size', () => {
  assert.equal(findDisplay(null, [main, tv]), null)
  assert.equal(findDisplay({ id: 2, label: 'LG TV', width: 1, height: 1 }, [main, tv]), tv)
  assert.equal(findDisplay({ id: 7, label: 'LG TV', width: 3840, height: 2160 }, [main, tv]), tv)
  // Same id but another monitor plugged in: not the same display.
  assert.equal(findDisplay({ id: 2, label: 'Beamer', width: 1280, height: 720 }, [main, tv]), null)
})

test('player display survives a restart and broken settings are ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bv-disp-'))
  try {
    assert.equal(loadPlayerDisplay(dir), null)
    savePlayerDisplay(dir, tv)
    assert.deepEqual(loadPlayerDisplay(dir), { id: 2, label: 'LG TV', width: 3840, height: 2160 })
    writeFileSync(join(dir, 'settings.json'), '{ nope')
    assert.equal(loadPlayerDisplay(dir), null)
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ playerDisplay: { id: '2' } }))
    assert.equal(loadPlayerDisplay(dir), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
