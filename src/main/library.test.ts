import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkName, importFiles, isInside, isMedia, listAssets, removeAsset, saveAsset, saveThumb } from './library.ts'

function withTemp(fn: (root: string) => Promise<void>): () => Promise<void> {
  return async () => {
    const root = mkdtempSync(join(tmpdir(), 'bv-lib-'))
    try {
      await fn(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

test('isMedia accepts the supported formats case-insensitively', () => {
  for (const n of ['a.PNG', 'a.jpeg', 'a.webp', 'a.svg', 'a.ico', 'a.gif', 'a.webm', 'a.mp4']) assert.ok(isMedia(n), n)
  for (const n of ['a.pdf', 'a.exe', 'a', 'png']) assert.ok(!isMedia(n), n)
})

test('isInside blocks traversal', () => {
  const root = join('F:', 'data')
  assert.ok(isInside(root, join(root, 'assets', 'maps', 'a.png')))
  assert.ok(!isInside(root, join(root, '..', 'secret.txt')))
  assert.ok(isInside(root, join(root, 'assets', '..map.png')))
  assert.ok(isInside(root, join(root, '..map.png')))
  assert.ok(!isInside(root, root))
  assert.ok(!isInside(root, join('C:', 'Windows')))
})

test('checkName rejects paths', () => {
  assert.equal(checkName('map.png'), 'map.png')
  for (const bad of ['', '.', '..', '../x.png', 'a/b.png', 'a\\b.png']) assert.throws(() => checkName(bad), bad)
})

test(
  'import, list, thumb and remove',
  withTemp(async (root) => {
    const data = join(root, 'data')
    const src = join(root, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'cave.png'), 'x')
    writeFileSync(join(src, 'notes.txt'), 'x')

    writeFileSync(join(src, 'copy.png'), 'x')
    mkdirSync(join(src, 'other'))
    writeFileSync(join(src, 'other', 'cave.png'), 'y')

    const first = await importFiles(data, 'maps', [join(src, 'cave.png'), join(src, 'notes.txt')])
    assert.deepEqual(first, { imported: ['cave.png'], rejected: ['notes.txt'], duplicates: [] })
    // Same content under any name is skipped; another file with a taken name is renamed.
    const second = await importFiles(data, 'maps', [join(src, 'cave.png'), join(src, 'copy.png'), join(src, 'other', 'cave.png')])
    assert.deepEqual(second, {
      imported: ['cave (2).png'],
      rejected: [],
      duplicates: [
        { name: 'cave.png', existing: 'cave.png' },
        { name: 'copy.png', existing: 'cave.png' }
      ]
    })
    // Only within the category.
    assert.deepEqual((await importFiles(data, 'props', [join(src, 'cave.png')])).imported, ['cave.png'])
    await removeAsset(data, 'props', 'cave.png')

    let assets = await listAssets(data)
    assert.deepEqual(
      assets.map((a) => [a.kind, a.name, a.thumbUrl]),
      [
        ['maps', 'cave (2).png', null],
        ['maps', 'cave.png', null]
      ]
    )
    assert.equal(assets[0]?.url, 'bv://data/assets/maps/cave%20(2).png')

    await saveThumb(data, 'maps', 'cave.png', new Uint8Array([1]))
    assets = await listAssets(data)
    assert.equal(assets[1]?.thumbUrl, 'bv://data/thumbs/maps/cave.png.webp')

    await removeAsset(data, 'maps', 'cave.png')
    assert.deepEqual(readdirSync(join(data, 'trash', 'maps')), ['cave.png'])
    assert.ok(!existsSync(join(data, 'thumbs', 'maps', 'cave.png.webp')))
    assert.deepEqual(
      (await listAssets(data)).map((a) => a.name),
      ['cave (2).png']
    )
  })
)

test(
  'saveAsset only writes media files with plain names',
  withTemp(async (root) => {
    assert.deepEqual(await saveAsset(root, 'maps', 'page.png', new Uint8Array([1])), { name: 'page.png', duplicate: false })
    assert.deepEqual(await saveAsset(root, 'maps', 'page.png', new Uint8Array([2])), { name: 'page (2).png', duplicate: false })
    assert.deepEqual(await saveAsset(root, 'maps', 'other.png', new Uint8Array([2])), { name: 'page (2).png', duplicate: true })
    await assert.rejects(saveAsset(root, 'maps', 'evil.exe', new Uint8Array([1])))
    await assert.rejects(saveAsset(root, 'maps', '../x.png', new Uint8Array([1])))
  })
)
