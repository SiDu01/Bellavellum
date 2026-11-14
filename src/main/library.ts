import { access, copyFile, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative } from 'node:path'
import { ASSET_KINDS, type Asset, type AssetKind, type ImportResult } from '../shared/types.ts'

export const MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.gif', '.webm', '.mp4'])
export const ASSET_HOST = 'bv://data'

export function isMedia(name: string): boolean {
  return MEDIA_EXTS.has(extname(name).toLowerCase())
}

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === 'string' && (ASSET_KINDS as readonly string[]).includes(value)
}

export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** Names come from the renderer: reject anything that is not a plain file name. */
export function checkName(name: string): string {
  if (!name || name !== basename(name) || name === '.' || name === '..') throw new Error(`Ungültiger Dateiname: ${name}`)
  return name
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
const url = (...parts: string[]): string => `${ASSET_HOST}/${parts.map(encodeURIComponent).join('/')}`

async function names(dir: string): Promise<string[]> {
  return readdir(dir).catch(() => [])
}

export async function listAssets(dataDir: string): Promise<Asset[]> {
  const assets: Asset[] = []
  for (const kind of ASSET_KINDS) {
    const files = (await names(assetDir(dataDir, kind))).filter(isMedia).sort((a, b) => a.localeCompare(b))
    const thumbs = new Set(await names(thumbDir(dataDir, kind)))
    for (const name of files) {
      const thumb = `${name}.webp`
      assets.push({
        kind,
        name,
        url: url('assets', kind, name),
        thumbUrl: thumbs.has(thumb) ? url('thumbs', kind, thumb) : null
      })
    }
  }
  return assets
}

export async function importFiles(dataDir: string, kind: AssetKind, paths: string[]): Promise<ImportResult> {
  const dir = assetDir(dataDir, kind)
  await mkdir(dir, { recursive: true })
  const result: ImportResult = { imported: [], rejected: [] }
  for (const path of paths) {
    if (!isMedia(path)) {
      result.rejected.push(basename(path))
      continue
    }
    const name = await uniqueName(dir, basename(path))
    await copyFile(path, join(dir, name))
    result.imported.push(name)
  }
  return result
}

/** For files the renderer produced itself (PDF pages). Returns the final name. */
export async function saveAsset(dataDir: string, kind: AssetKind, name: string, bytes: Uint8Array): Promise<string> {
  if (!isMedia(checkName(name))) throw new Error(`Format nicht unterstützt: ${name}`)
  const dir = assetDir(dataDir, kind)
  await mkdir(dir, { recursive: true })
  const finalName = await uniqueName(dir, name)
  await writeFile(join(dir, finalName), bytes)
  return finalName
}

export async function saveThumb(dataDir: string, kind: AssetKind, name: string, bytes: Uint8Array): Promise<void> {
  const dir = thumbDir(dataDir, kind)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${checkName(name)}.webp`), bytes)
}

/** Moves to data/trash instead of the OS trash: removable drives on Windows have no recycle bin. */
export async function removeAsset(dataDir: string, kind: AssetKind, name: string): Promise<void> {
  checkName(name)
  const trash = join(dataDir, 'trash', kind)
  await mkdir(trash, { recursive: true })
  await rename(join(assetDir(dataDir, kind), name), join(trash, await uniqueName(trash, name)))
  await rm(join(thumbDir(dataDir, kind), `${name}.webp`), { force: true })
}
