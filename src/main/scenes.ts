import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_KINDS, BLEND_MODES, type Scene, type SceneList } from '../shared/types.ts'
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

/** Scene files live on the stick and may be edited by hand, so check the shape before trusting them. */
export function isScene(v: unknown): v is Scene {
  if (!isObj(v)) return false
  const view = v.view
  return (
    typeof v.id === 'string' &&
    ID.test(v.id) &&
    typeof v.name === 'string' &&
    Array.isArray(v.layers) &&
    v.layers.every(isLayer) &&
    (view === null || (isObj(view) && [view.x, view.y, view.width, view.height].every(isNum)))
  )
}

const sceneDir = (dataDir: string): string => join(dataDir, 'scenes')
const sceneFile = (dataDir: string, id: unknown): string => join(sceneDir(dataDir), `${checkSceneId(id)}.json`)

export async function loadScene(dataDir: string, id: unknown): Promise<Scene> {
  const data: unknown = JSON.parse(await readFile(sceneFile(dataDir, id), 'utf8'))
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

export async function deleteScene(dataDir: string, id: unknown): Promise<void> {
  const file = sceneFile(dataDir, id)
  const trash = join(dataDir, 'trash', 'scenes')
  await mkdir(trash, { recursive: true })
  await rename(file, join(trash, await uniqueName(trash, `${String(id)}.json`)))
}
