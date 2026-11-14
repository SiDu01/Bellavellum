import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DATA_SUBDIRS, ensureDataDir, resolveDataDir } from './dataDir.ts'

const exePath = join('E:', 'Temp', 'unpacked', 'Bellavellum.exe')

test('dev uses data/ in the project', () => {
  assert.equal(resolveDataDir({ packaged: false, exePath, appPath: join('D:', 'proj') }), join('D:', 'proj', 'data'))
})

test('portable build uses the stick folder, not the temp unpack dir', () => {
  const dir = resolveDataDir({ packaged: true, exePath, appPath: 'x', portableDir: join('F:', 'BELLAVELLUM') })
  assert.equal(dir, join('F:', 'BELLAVELLUM', 'data'))
})

test('AppImage uses the folder of the .AppImage, not its /tmp mount', () => {
  const dir = resolveDataDir({
    packaged: true,
    exePath: '/tmp/.mount_BellavXYZ/bellavellum',
    appPath: 'x',
    appImage: '/media/stick/BELLAVELLUM/Bellavellum.AppImage'
  })
  assert.equal(dir, join('/media/stick/BELLAVELLUM', 'data'))
})

test('unpacked build uses the folder of the exe', () => {
  assert.equal(resolveDataDir({ packaged: true, exePath, appPath: 'x' }), join('E:', 'Temp', 'unpacked', 'data'))
})

test('ensureDataDir creates all subfolders and is idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'bv-'))
  try {
    ensureDataDir(join(root, 'data'))
    ensureDataDir(join(root, 'data'))
    for (const sub of DATA_SUBDIRS) assert.ok(existsSync(join(root, 'data', sub)), sub)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
