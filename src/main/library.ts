import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yauzl, { type Entry } from 'yauzl'
import { baseOf, joinPath, movedPath, parentOf } from '../shared/assetPaths.ts'
import {
  ASSET_KINDS,
  assetUrl,
  dataUrl,
  type Asset,
  type AssetKind,
  type ImportItem,
  type ImportResult,
  type ImportSource,
  type LibraryList,
  type ScanResult
} from '../shared/types.ts'

export const MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.gif', '.webm', '.mp4'])

export function isMedia(name: string): boolean {
  return MEDIA_EXTS.has(extname(name).toLowerCase())
}

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === 'string' && (ASSET_KINDS as readonly string[]).includes(value)
}

export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  // Only a whole ".." segment leaves the root; "..map.png" is a valid file name.
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/**
 * Asset paths come from the renderer and from ZIPs: "/"-separated segments that are valid file names
 * on Windows too (the stick moves between systems). Windows drops trailing dots and spaces, so those are out.
 */
export function checkPath(path: unknown): string {
  const ok =
    typeof path === 'string' &&
    path.split('/').every((s) => s !== '' && s !== '.' && s !== '..' && !/[<>:"\\|?*\x00-\x1f]|[. ]$/.test(s))
  if (!ok) throw new Error(`Ungültiger Name: ${String(path)}`)
  return path
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

/** "map.png" -> "map (2).png" if taken. */
export async function uniqueName(dir: string, name: string): Promise<string> {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = name
  for (let i = 2; await exists(join(dir, candidate)); i++) candidate = `${stem} (${i})${ext}`
  return candidate
}

const assetDir = (dataDir: string, kind: AssetKind): string => join(dataDir, 'assets', kind)
const thumbDir = (dataDir: string, kind: AssetKind): string => join(dataDir, 'thumbs', kind)
const onDisk = (dir: string, path: string): string => join(dir, ...path.split('/'))

/** Files and folders below `dir` as "/"-separated paths. */
async function walk(dir: string): Promise<{ files: string[]; dirs: string[] }> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])
  const files: string[] = []
  const dirs: string[] = []
  for (const e of entries) {
    const path = relative(dir, join(e.parentPath, e.name)).split(sep).join('/')
    if (e.isDirectory()) dirs.push(path)
    else if (e.isFile()) files.push(path)
  }
  return { files, dirs }
}

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex')

async function hashStream(stream: Readable): Promise<string> {
  // Streamed: videos can be far bigger than we want in memory.
  const hash = createHash('sha256')
  for await (const chunk of stream) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

/** Media files of a category by size, so most files are never hashed. */
type SizeIndex = Map<number, string[]>

async function sizeIndex(dir: string): Promise<SizeIndex> {
  const index: SizeIndex = new Map()
  for (const path of (await walk(dir)).files.filter(isMedia)) addToIndex(index, (await stat(onDisk(dir, path))).size, path)
  return index
}

function addToIndex(index: SizeIndex, size: number, path: string): void {
  index.set(size, [...(index.get(size) ?? []), path])
}

/** Path of a file in the category with the same content. */
async function findDuplicate(dir: string, index: SizeIndex, size: number, hash: () => Promise<string>): Promise<string | null> {
  let own: string | undefined
  for (const path of index.get(size) ?? []) {
    own ??= await hash()
    if ((await hashStream(createReadStream(onDisk(dir, path)))) === own) return path
  }
  return null
}

export async function listAssets(dataDir: string): Promise<LibraryList> {
  const list: LibraryList = { assets: [], folders: [] }
  for (const kind of ASSET_KINDS) {
    const { files, dirs } = await walk(assetDir(dataDir, kind))
    const thumbs = new Set((await walk(thumbDir(dataDir, kind))).files)
    for (const name of files.filter(isMedia).sort((a, b) => a.localeCompare(b))) {
      const thumb = `${name}.webp`
      list.assets.push({ kind, name, url: assetUrl(kind, name), thumbUrl: thumbs.has(thumb) ? dataUrl('thumbs', kind, thumb) : null })
    }
    for (const path of dirs.sort((a, b) => a.localeCompare(b))) list.folders.push({ kind, path })
  }
  return list
}

interface Zip {
  entries: Map<string, Entry>
  open: (entry: Entry) => Promise<Readable>
  close: () => void
}

async function openZip(file: string): Promise<Zip> {
  // yauzl rejects absolute and ".." entry names and turns backslashes into "/".
  const zip = await yauzl.openPromise(file, { lazyEntries: true, autoClose: false })
  const entries = new Map<string, Entry>()
  await new Promise<void>((resolve, reject) => {
    zip.on('entry', (e: Entry) => {
      entries.set(e.fileName, e)
      zip.readEntry()
    })
    zip.on('end', resolve)
    zip.on('error', reject)
    zip.readEntry()
  })
  return { entries, open: (e) => zip.openReadStreamPromise(e), close: () => zip.close() }
}

/** macOS metadata and dot files are never wanted. */
const isJunk = (path: string): boolean => path.split('/').some((s) => s.startsWith('.') || s === '__MACOSX')

/** What the files, folders and ZIPs at `paths` would import, with their folder structure. */
export async function scanSources(paths: string[]): Promise<ScanResult> {
  const result: ScanResult = { files: [], skipped: [] }
  const add = (source: ImportSource, path: string): void => {
    if (isJunk(path)) return
    if (isMedia(path)) result.files.push({ source, path })
    else result.skipped.push(path)
  }
  for (const file of paths) {
    try {
      if ((await stat(file)).isDirectory()) {
        // The folder itself becomes the top folder.
        for (const path of (await walk(file)).files) add({ file: join(file, ...path.split('/')) }, joinPath(basename(file), path))
      } else if (extname(file).toLowerCase() === '.zip') {
        const zip = await openZip(file)
        zip.close()
        const names = [...zip.entries.keys()].filter((n) => !n.endsWith('/') && !isJunk(n))
        // Packs often hold one top folder already; only otherwise does the ZIP's own name become one.
        const tops = new Set(names.map((n) => (n.includes('/') ? n.slice(0, n.indexOf('/')) : '')))
        const prefix = tops.size === 1 && !tops.has('') ? '' : basename(file, extname(file))
        for (const entry of names) add({ file, entry }, joinPath(prefix, entry))
      } else add({ file }, basename(file))
    } catch {
      result.skipped.push(basename(file))
    }
  }
  return result
}

export async function importFiles(dataDir: string, kind: AssetKind, items: ImportItem[]): Promise<ImportResult> {
  const dir = assetDir(dataDir, kind)
  await mkdir(dir, { recursive: true })
  const index = await sizeIndex(dir)
  const result: ImportResult = { imported: [], rejected: [], duplicates: [], failed: [] }
  const zips = new Map<string, Promise<Zip>>()
  try {
    for (const { source, path } of items) {
      const label = String(path)
      if (!isMedia(label)) {
        result.rejected.push(label)
        continue
      }
      let target: string | undefined
      try {
        checkPath(path)
        let size: number
        let open: () => Promise<Readable>
        if (source.entry === undefined) {
          size = (await stat(source.file)).size
          open = async () => createReadStream(source.file)
        } else {
          if (!zips.has(source.file)) zips.set(source.file, openZip(source.file))
          const zip = await (zips.get(source.file) as Promise<Zip>)
          const entry = zip.entries.get(source.entry)
          if (!entry) throw new Error(`Nicht im ZIP: ${source.entry}`)
          size = entry.uncompressedSize
          open = () => zip.open(entry)
        }
        const existing = await findDuplicate(dir, index, size, async () => hashStream(await open()))
        if (existing) {
          result.duplicates.push({ name: label, existing })
          continue
        }
        const parent = onDisk(dir, parentOf(path))
        await mkdir(parent, { recursive: true })
        const name = joinPath(parentOf(path), await uniqueName(parent, baseOf(path)))
        target = onDisk(dir, name)
        await pipeline(await open(), createWriteStream(target, { flags: 'wx' }))
        addToIndex(index, size, name)
        result.imported.push(name)
      } catch {
        // A half-written file would show up as a broken asset.
        if (target) await rm(target, { force: true })
        result.failed.push(label)
      }
    }
  } finally {
    for (const zip of zips.values()) await zip.then((z) => z.close(), () => undefined)
  }
  return result
}

/** For files the renderer produced itself (PDF pages). Returns the final path, or the existing file's on a duplicate. */
export async function saveAsset(
  dataDir: string,
  kind: AssetKind,
  path: string,
  bytes: Uint8Array
): Promise<{ name: string; duplicate: boolean }> {
  if (!isMedia(checkPath(path))) throw new Error(`Format nicht unterstützt: ${path}`)
  const dir = assetDir(dataDir, kind)
  const existing = await findDuplicate(dir, await sizeIndex(dir), bytes.length, async () => sha256(bytes))
  if (existing) return { name: existing, duplicate: true }
  const parent = onDisk(dir, parentOf(path))
  await mkdir(parent, { recursive: true })
  const name = joinPath(parentOf(path), await uniqueName(parent, baseOf(path)))
  await writeFile(onDisk(dir, name), bytes)
  return { name, duplicate: false }
}

export async function saveThumb(dataDir: string, kind: AssetKind, path: string, bytes: Uint8Array): Promise<void> {
  const file = onDisk(thumbDir(dataDir, kind), `${checkPath(path)}.webp`)
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, bytes)
}

export async function makeFolder(dataDir: string, kind: AssetKind, path: string): Promise<void> {
  await mkdir(onDisk(assetDir(dataDir, kind), checkPath(path)), { recursive: true })
}

const ignoreMissing = (err: NodeJS.ErrnoException): void => {
  if (err.code !== 'ENOENT') throw err
}

/** Moves or renames a file or folder. Scenes that use it are updated by the caller. */
export async function moveAsset(dataDir: string, kind: AssetKind, from: string, to: string): Promise<void> {
  checkPath(from)
  checkPath(to)
  if (movedPath(to, from, '') !== null) throw new Error('Ein Ordner kann nicht in sich selbst verschoben werden')
  const dir = assetDir(dataDir, kind)
  const source = onDisk(dir, from)
  const target = onDisk(dir, to)
  const isFile = (await stat(source)).isFile()
  if (isFile && !isMedia(to)) throw new Error(`Format nicht unterstützt: ${to}`)
  // A case-only rename finds itself on Windows' case-insensitive file systems.
  if (from.toLowerCase() !== to.toLowerCase() && (await exists(target))) throw new Error(`„${to}“ existiert schon`)
  await mkdir(join(target, '..'), { recursive: true })
  await rename(source, target)
  const thumbs = thumbDir(dataDir, kind)
  const [thumbFrom, thumbTo] = isFile ? [`${from}.webp`, `${to}.webp`] : [from, to]
  await mkdir(join(onDisk(thumbs, thumbTo), '..'), { recursive: true })
  await rename(onDisk(thumbs, thumbFrom), onDisk(thumbs, thumbTo)).catch(ignoreMissing)
}

/** File or folder. Moves to data/trash instead of the OS trash: removable drives on Windows have no recycle bin. */
export async function removeAsset(dataDir: string, kind: AssetKind, path: string): Promise<void> {
  checkPath(path)
  const trash = join(dataDir, 'trash', kind)
  await mkdir(trash, { recursive: true })
  const source = onDisk(assetDir(dataDir, kind), path)
  const isFile = (await stat(source)).isFile()
  await rename(source, join(trash, await uniqueName(trash, baseOf(path))))
  await rm(onDisk(thumbDir(dataDir, kind), isFile ? `${path}.webp` : path), { recursive: true, force: true })
}
