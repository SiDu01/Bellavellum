import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { crc32 } from 'node:zlib'
import {
  checkPath,
  importFiles,
  isInside,
  isMedia,
  listAssets,
  makeFolder,
  moveAsset,
  removeAsset,
  saveAsset,
  saveThumb,
  scanSources
} from './library.ts'

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

/** Import items that keep each file's own name at the top level. */
const files = (...paths: string[]) => paths.map((file) => ({ source: { file }, path: basename(file) }))

/** A ZIP with stored (uncompressed) entries; enough for yauzl. */
function makeZip(entries: Record<string, string>): Buffer {
  const parts: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name)
    const data = Buffer.from(text)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    parts.push(local, nameBuf, data)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const dir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centrals.length / 2, 8)
  end.writeUInt16LE(centrals.length / 2, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, dir, end])
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

test('checkPath allows folders but no traversal or Windows-invalid names', () => {
  assert.equal(checkPath('map.png'), 'map.png')
  assert.equal(checkPath('Dungeons/Sewers 1.jpg'), 'Dungeons/Sewers 1.jpg')
  const bad = ['', '.', '..', '../x.png', 'a/../b.png', '/a.png', 'a//b.png', 'a\\b.png', 'C:/x.png', 'a?.png', 'dir./a.png', 'a.png ', 3]
  for (const b of bad) assert.throws(() => checkPath(b), String(b))
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

    const first = await importFiles(data, 'maps', files(join(src, 'cave.png'), join(src, 'notes.txt')))
    assert.deepEqual(first, { imported: ['cave.png'], rejected: ['notes.txt'], duplicates: [], failed: [] })
    // Same content under any name is skipped; another file with a taken name is renamed.
    const second = await importFiles(data, 'maps', files(join(src, 'cave.png'), join(src, 'copy.png'), join(src, 'other', 'cave.png')))
    assert.deepEqual(second, {
      imported: ['cave (2).png'],
      rejected: [],
      duplicates: [
        { name: 'cave.png', existing: 'cave.png' },
        { name: 'copy.png', existing: 'cave.png' }
      ],
      failed: []
    })
    // Only within the category.
    assert.deepEqual((await importFiles(data, 'props', files(join(src, 'cave.png')))).imported, ['cave.png'])
    await removeAsset(data, 'props', 'cave.png')

    let assets = (await listAssets(data)).assets
    assert.deepEqual(
      assets.map((a) => [a.kind, a.name, a.thumbUrl]),
      [
        ['maps', 'cave (2).png', null],
        ['maps', 'cave.png', null]
      ]
    )
    assert.equal(assets[0]?.url, 'bv://data/assets/maps/cave%20(2).png')

    await saveThumb(data, 'maps', 'cave.png', new Uint8Array([1]))
    assets = (await listAssets(data)).assets
    assert.equal(assets[1]?.thumbUrl, 'bv://data/thumbs/maps/cave.png.webp')

    await removeAsset(data, 'maps', 'cave.png')
    assert.deepEqual(readdirSync(join(data, 'trash', 'maps')), ['cave.png'])
    assert.ok(!existsSync(join(data, 'thumbs', 'maps', 'cave.png.webp')))
    assert.deepEqual(
      (await listAssets(data)).assets.map((a) => a.name),
      ['cave (2).png']
    )
  })
)

test(
  'saveAsset only writes media files with valid paths',
  withTemp(async (root) => {
    assert.deepEqual(await saveAsset(root, 'maps', 'page.png', new Uint8Array([1])), { name: 'page.png', duplicate: false })
    assert.deepEqual(await saveAsset(root, 'maps', 'page.png', new Uint8Array([2])), { name: 'page (2).png', duplicate: false })
    assert.deepEqual(await saveAsset(root, 'maps', 'other.png', new Uint8Array([2])), { name: 'page (2).png', duplicate: true })
    assert.deepEqual(await saveAsset(root, 'maps', 'PDF/page.png', new Uint8Array([3])), { name: 'PDF/page.png', duplicate: false })
    await assert.rejects(saveAsset(root, 'maps', 'evil.exe', new Uint8Array([1])))
    await assert.rejects(saveAsset(root, 'maps', '../x.png', new Uint8Array([1])))
  })
)

test(
  'a file that cannot be read does not stop the files after it',
  withTemp(async (root) => {
    const src = join(root, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'late.png'), 'z')
    const result = await importFiles(join(root, 'data'), 'maps', files(join(src, 'gone.png'), join(src, 'late.png')))
    assert.deepEqual([result.failed, result.imported], [['gone.png'], ['late.png']])
  })
)

test(
  'scan keeps the folder structure of folders and ZIPs and skips junk',
  withTemp(async (root) => {
    const pack = join(root, 'Valor')
    mkdirSync(join(pack, 'Dungeons'), { recursive: true })
    writeFileSync(join(pack, 'Dungeons', 'sewers.jpg'), 'a')
    writeFileSync(join(pack, 'readme.txt'), 'b')
    writeFileSync(join(pack, '.DS_Store.png'), 'c')
    writeFileSync(join(root, 'one.zip'), makeZip({ 'Pack/a.png': '1', 'Pack/sub/b.png': '2', '__MACOSX/Pack/._a.png': 'x' }))
    writeFileSync(join(root, 'loose.zip'), makeZip({ 'a.png': '1', 'sub/b.png': '2' }))
    writeFileSync(join(root, 'map.webp'), 'm')

    const scan = await scanSources([pack, join(root, 'one.zip'), join(root, 'loose.zip'), join(root, 'map.webp'), join(root, 'gone')])
    assert.deepEqual(
      scan.files.map((f) => f.path),
      ['Valor/Dungeons/sewers.jpg', 'Pack/a.png', 'Pack/sub/b.png', 'loose/a.png', 'loose/sub/b.png', 'map.webp']
    )
    assert.deepEqual(scan.skipped, ['Valor/readme.txt', 'gone'])
    assert.deepEqual(scan.files[2]?.source, { file: join(root, 'one.zip'), entry: 'Pack/sub/b.png' })
  })
)

test(
  'import from ZIPs into subfolders, with renames, duplicates and bad paths',
  withTemp(async (root) => {
    const data = join(root, 'data')
    const zip = join(root, 'p.zip')
    writeFileSync(zip, makeZip({ 'a.png': 'one', 'b.png': 'two', 'c.png': 'one' }))
    writeFileSync(join(root, 'x.png'), 'three')
    const result = await importFiles(data, 'maps', [
      { source: { file: zip, entry: 'a.png' }, path: 'Pack/Alpha.png' },
      { source: { file: zip, entry: 'b.png' }, path: 'Pack/Deep/Beta.png' },
      { source: { file: zip, entry: 'c.png' }, path: 'Pack/Gamma.png' },
      { source: { file: zip, entry: 'missing.png' }, path: 'Pack/M.png' },
      { source: { file: join(root, 'x.png') }, path: 'Pack/Alpha.png' },
      { source: { file: join(root, 'x.png') }, path: '../evil.png' }
    ])
    assert.deepEqual(result, {
      imported: ['Pack/Alpha.png', 'Pack/Deep/Beta.png', 'Pack/Alpha (2).png'],
      rejected: [],
      duplicates: [{ name: 'Pack/Gamma.png', existing: 'Pack/Alpha.png' }],
      failed: ['Pack/M.png', '../evil.png']
    })
    assert.ok(!existsSync(join(root, 'evil.png')))
    const list = await listAssets(data)
    assert.deepEqual(
      list.folders.map((f) => f.path),
      ['Pack', 'Pack/Deep']
    )
    assert.equal(list.assets.find((a) => a.name === 'Pack/Deep/Beta.png')?.url, 'bv://data/assets/maps/Pack%2FDeep%2FBeta.png')
  })
)

test(
  'move and remove files and folders together with their thumbnails',
  withTemp(async (root) => {
    await saveAsset(root, 'maps', 'A/cave.png', new Uint8Array([1]))
    await saveThumb(root, 'maps', 'A/cave.png', new Uint8Array([9]))
    await makeFolder(root, 'maps', 'B')

    await moveAsset(root, 'maps', 'A/cave.png', 'A/Höhle.png')
    await moveAsset(root, 'maps', 'A', 'B/A')
    let list = await listAssets(root)
    assert.deepEqual(
      list.assets.map((a) => [a.name, a.thumbUrl !== null]),
      [['B/A/Höhle.png', true]]
    )
    assert.deepEqual(
      list.folders.map((f) => f.path),
      ['B', 'B/A']
    )

    await assert.rejects(moveAsset(root, 'maps', 'B', 'B/A/B'))
    await saveAsset(root, 'maps', 'other.png', new Uint8Array([2]))
    await assert.rejects(moveAsset(root, 'maps', 'other.png', 'B/A/Höhle.png'))
    await assert.rejects(moveAsset(root, 'maps', 'other.png', 'other.txt'))
    // Case-only renames find themselves on case-insensitive file systems and must still work.
    await moveAsset(root, 'maps', 'other.png', 'Other.png')

    await removeAsset(root, 'maps', 'B')
    list = await listAssets(root)
    assert.deepEqual(
      list.assets.map((a) => a.name),
      ['Other.png']
    )
    assert.deepEqual(readdirSync(join(root, 'trash', 'maps')), ['B'])
    assert.ok(!existsSync(join(root, 'thumbs', 'maps', 'B')))
  })
)
