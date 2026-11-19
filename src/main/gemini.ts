import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SuggestedRoom } from '../shared/types.ts'

// shortcut: fixed model and API revision; make them settings if Google retires them.
const MODEL = 'gemini-4-hydrogen'
const API_REVISION = '2026-05-20'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'
/** One HTTP request; the long thinking runs in the background between polls. */
const REQUEST_TIMEOUT_MS = 60_000
const POLL_MS = 5_000
/** Measured: ~15k thought tokens on a 32 × 42 dungeon, more than 3 minutes. */
const MAX_WAIT_MS = 10 * 60_000

const keyFile = (dataDir: string): string => join(dataDir, 'gemini-key.txt')

export function loadGeminiKey(dataDir: string): string | null {
  try {
    return readFileSync(keyFile(dataDir), 'utf8').trim() || null
  } catch {
    return null
  }
}

/** An empty key removes the file. */
export function saveGeminiKey(dataDir: string, key: string): void {
  const k = key.trim()
  if (k) writeFileSync(keyFile(dataDir), k)
  else rmSync(keyFile(dataDir), { force: true })
}

export function roomPrompt(cols: number, rows: number): string {
  return [
    `This is a top-down tabletop battlemap. A numbered grid is drawn on it: ${cols} columns (0–${cols - 1}, left to right) and ${rows} rows (0–${rows - 1}, top to bottom).`,
    'Identify every enclosed room, corridor, walkway and deck area. Walls, solid rock, railings, ship hulls and water belong to no room.',
    'Each room is the union of its rectangles in grid cells (col/row = top-left cell, w/h = size in cells). Name rooms briefly in German.'
  ].join('\n')
}

const SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      rects: {
        type: 'array',
        items: {
          type: 'object',
          properties: { col: { type: 'integer' }, row: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' } },
          required: ['col', 'row', 'w', 'h']
        }
      }
    },
    required: ['name', 'rects']
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Text of the last model_output step of an Interactions API response. */
export function modelText(body: unknown): string {
  const steps = isRecord(body) && Array.isArray(body['steps']) ? body['steps'] : []
  const out = steps.filter((s): s is Record<string, unknown> => isRecord(s) && s['type'] === 'model_output').at(-1)
  const content = out && Array.isArray(out['content']) ? out['content'] : []
  const text = content
    .filter((c): c is Record<string, unknown> => isRecord(c) && c['type'] === 'text' && typeof c['text'] === 'string')
    .map((c) => c['text'])
    .join('')
  if (!text) throw new Error('Gemini hat keine Antwort geliefert')
  return text
}

/** Rooms from Gemini's JSON, rectangles clipped to the grid; anything malformed is dropped. */
export function parseRooms(text: string, cols: number, rows: number): SuggestedRoom[] {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    throw new Error('Gemini hat kein gültiges JSON geliefert')
  }
  if (!Array.isArray(v)) throw new Error('Gemini hat keine Raumliste geliefert')
  const int = (n: unknown): n is number => Number.isInteger(n)
  const rooms: SuggestedRoom[] = []
  for (const r of v) {
    if (!isRecord(r) || !Array.isArray(r['rects'])) continue
    const rects = r['rects'].flatMap((q: unknown) => {
      if (!isRecord(q)) return []
      const { col, row, w, h } = q
      if (!int(col) || !int(row) || !int(w) || !int(h)) return []
      const c0 = Math.max(0, col)
      const r0 = Math.max(0, row)
      const c1 = Math.min(cols, col + w)
      const r1 = Math.min(rows, row + h)
      return c1 > c0 && r1 > r0 ? [{ col: c0, row: r0, w: c1 - c0, h: r1 - r0 }] : []
    })
    const name = typeof r['name'] === 'string' && r['name'].trim() ? r['name'].trim().slice(0, 80) : `Raum ${rooms.length + 1}`
    if (rects.length > 0) rooms.push({ name, rects })
  }
  return rooms
}

async function request(key: string, url: string, body?: unknown): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': API_REVISION },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (err) {
    throw new Error(`Gemini nicht erreichbar (Internet?): ${String(err)}`)
  }
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = isRecord(json) && isRecord(json['error']) ? String(json['error']['message']) : res.statusText
    throw new Error(`Gemini-Fehler ${res.status}: ${msg}`)
  }
  return json
}

/** Starts the interaction in the background and polls until it is no longer in progress. */
export async function suggestRooms(key: string, jpeg: Uint8Array, cols: number, rows: number): Promise<SuggestedRoom[]> {
  let body = await request(key, ENDPOINT, {
    model: MODEL,
    background: true,
    input: [
      { type: 'text', text: roomPrompt(cols, rows) },
      { type: 'image', data: Buffer.from(jpeg).toString('base64'), mime_type: 'image/jpeg' }
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA }
  })
  const id = isRecord(body) ? body['id'] : undefined
  const status = (): unknown => (isRecord(body) ? body['status'] : undefined)
  const deadline = Date.now() + MAX_WAIT_MS
  while (status() === 'in_progress') {
    if (typeof id !== 'string') throw new Error('Gemini hat keine Auftrags-ID geliefert')
    if (Date.now() > deadline) throw new Error('Gemini hat nach 10 Minuten nicht geantwortet')
    await new Promise((r) => setTimeout(r, POLL_MS))
    body = await request(key, `${ENDPOINT}/${encodeURIComponent(id)}`)
  }
  if (status() !== 'completed') throw new Error(`Gemini-Auswertung abgebrochen (Status: ${String(status())})`)
  return parseRooms(modelText(body), cols, rows)
}
