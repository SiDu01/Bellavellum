import type { Scene } from '../../shared/types'

/** Undo and redo of scene edits, kept in memory per opened scene. */
export interface History {
  past: Scene[]
  future: Scene[]
  /** Time of the last recorded edit; edits closer together than MERGE_MS form one step. */
  last: number
}

export const MAX_STEPS = 100
/** A drag or a slider fires an edit per frame; together they should undo in one go. */
export const MERGE_MS = 500

export const emptyHistory: History = { past: [], future: [], last: 0 }

/** Call with the scene as it was before an edit. */
export function record(h: History, before: Scene, now: number): History {
  if (now - h.last < MERGE_MS) return { ...h, future: [], last: now }
  return { past: [...h.past, before].slice(-MAX_STEPS), future: [], last: now }
}

/**
 * The fog mask lives in its own PNG and is not part of the history, so a restored scene keeps the current
 * mask's revision and rect. Only switching fog on or off is undone.
 */
function withCurrentFog(target: Scene, current: Scene): Scene {
  const fog = current.fog && target.fog ? { ...current.fog, enabled: target.fog.enabled } : current.fog
  return { ...target, fog }
}

export function undo(h: History, current: Scene): { history: History; scene: Scene } | null {
  const target = h.past.at(-1)
  if (!target) return null
  return { history: { past: h.past.slice(0, -1), future: [...h.future, current], last: 0 }, scene: withCurrentFog(target, current) }
}

export function redo(h: History, current: Scene): { history: History; scene: Scene } | null {
  const target = h.future.at(-1)
  if (!target) return null
  return { history: { past: [...h.past, current], future: h.future.slice(0, -1), last: 0 }, scene: withCurrentFog(target, current) }
}

/** Applies a change to every stored step, e.g. an asset rename that must not come back on undo. */
export const mapHistory = (h: History, fn: (s: Scene) => Scene): History => ({ ...h, past: h.past.map(fn), future: h.future.map(fn) })
