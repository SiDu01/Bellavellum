import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_KINDS, BLEND_MODES, DEFAULT_GRID, GRID_TYPES, type Scene, type SceneList } from '../shared/types.ts'
import { uniqueName } from './library.ts'

const ID = /^[a-z0-9-]{1,64}$/

export function checkSceneId(id: unknown): string {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error(`Ungültige Szenen-ID: ${String(id)}`)
  return id
}

const isNum = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const oneOf = (list: readonly string[], v: unknown): boolean => typeof v === 'string' && list.includes(v)

function isLayer(v: unknown): boolean {
  if (!isObj(v) || !isObj(v.crop)) return false
  const c = v.crop
  return (
    typeof v.id === 'string' &&
    oneOf(ASSET_KINDS, v.kind) &&
    typeof v.name === 'string' &&
    [v.width, v.height, v.x, v.y, v.scale, v.rotation, v.opacity, c.top, c.right, c.bottom, c.left].every(isNum) &&
    oneOf(BLEND_MODES, v.blend) &&
    typeof v.visible === 'boolean'
  )
}

function isGrid(v: unknown): boolean {
  return (
    isObj(v) &&
    oneOf(GRID_TYPES, v.type) &&
    [v.size, v.offsetX, v.offsetY, v.opacity].every(isNum) &&
    (v.size as number) > 0 &&
    typeof v.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(v.color) &&
    typeof v.visible === 'boolean' &&
    typeof v.snap === 'boolean'
  )
}

function isToken(v: unknown): boolean {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    oneOf(ASSET_KINDS, v.kind) &&
    typeof v.name === 'string' &&
    [v.x, v.y, v.cells].every(isNum) &&
    (v.cells as number) > 0 &&
    typeof v.label === 'string' &&
    typeof v.visible === 'boolean'
  )
}

const isRect = (v: unknown): boolean => isObj(v) && [v.x, v.y, v.width, v.height].every(isNum)

function isFog(v: unknown): boolean {
  return (
    v === null ||
    (isObj(v) &&
      typeof v.enabled === 'boolean' &&
      isNum(v.revision) &&
      isRect(v.rect) &&
      isObj(v.rect) &&
      (v.rect.width as number) > 0 &&
      (v.rect.height as number) > 0)
  )
}

/** Scene files live on the stick and may be edited by hand, so check the shape before trusting them. */
export function isScene(v: unknown): v is Scene {
  if (!isObj(v)) return false
  const view = v.view
  return (
    isFog(v.fog) &&
    typeof v.id === 'string' &&
    ID.test(v.id) &&
    typeof v.name === 'string' &&
    Array.isArray(v.layers) &&
    v.layers.every(isLayer) &&
    isGrid(v.grid) &&
    Array.isArray(v.tokens) &&
    v.tokens.every(isToken) &&
    (view === null || isRect(view))
  )
}

/** Scenes saved before grid and tokens existed get the defaults. */
function withDefaults(v: unknown): unknown {
  if (!isObj(v)) return v
  return {
    ...v,
    grid: { ...DEFAULT_GRID, ...(isObj(v.grid) ? v.grid : {}) },
    tokens: v.tokens ?? [],
    fog: v.fog ?? null
  }
}

const sceneDir = (dataDir: string): string => join(dataDir, 'scenes')
const sceneFile = (dataDir: string, id: unknown): string => join(sceneDir(dataDir), `${checkSceneId(id)}.json`)

export async function loadScene(dataDir: string, id: unknown): Promise<Scene> {
  const data = withDefaults(JSON.parse(await readFile(sceneFile(dataDir, id), 'utf8')))
  if (!isScene(data) || data.id !== id) throw new Error(`Szene ${String(id)} ist beschädigt`)
  return data
}

export async function listScenes(dataDir: string): Promise<SceneList> {
  const files = (await readdir(sceneDir(dataDir)).catch(() => [])).filter((n) => n.endsWith('.json'))
  const result: SceneList = { scenes: [], broken: [] }
  for (const file of files) {
    try {
      const { id, name } = await loadScene(dataDir, file.slice(0, -'.json'.length))
      result.scenes.push({ id, name })
    } catch {
      result.broken.push(file)
    }
  }
  result.scenes.sort((a, b) => a.name.localeCompare(b.name))
  return result
}

/** Write to a temp file first: pulling the stick mid-write must not leave a half-written scene. */
export async function saveScene(dataDir: string, scene: unknown): Promise<Scene> {
  if (!isScene(scene)) throw new Error('Ungültige Szene')
  await mkdir(sceneDir(dataDir), { recursive: true })
  const file = sceneFile(dataDir, scene.id)
  await writeFile(`${file}.tmp`, JSON.stringify(scene, null, 2))
  await rename(`${file}.tmp`, file)
  return scene
}

const fogFile = (dataDir: string, id: unknown): string => join(sceneDir(dataDir), `${checkSceneId(id)}.fog.png`)
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export async function saveFog(dataDir: string, id: unknown, bytes: Uint8Array): Promise<void> {
  const file = fogFile(dataDir, id)
  if (!(bytes instanceof Uint8Array) || !PNG_SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error('Fog-Maske ist kein PNG')
  await mkdir(sceneDir(dataDir), { recursive: true })
  await writeFile(`${file}.tmp`, bytes)
  await rename(`${file}.tmp`, file)
}

export async function deleteScene(dataDir: string, id: unknown): Promise<void> {
  const file = sceneFile(dataDir, id)
  const trash = join(dataDir, 'trash', 'scenes')
  await mkdir(trash, { recursive: true })
  await rename(file, join(trash, await uniqueName(trash, `${String(id)}.json`)))
  await rename(fogFile(dataDir, id), join(trash, await uniqueName(trash, `${String(id)}.fog.png`))).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err
    }
  )
}
