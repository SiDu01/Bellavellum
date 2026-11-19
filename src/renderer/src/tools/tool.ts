import type { Dispatch, PointerEvent, ReactNode, SetStateAction } from 'react'
import type { Layer, Scene, Transient } from '../../../shared/types'
import type { Point } from '../wand'

export type PanelTab = 'layers' | 'grid' | 'fog' | 'rooms'

/** What the editor shares with its tools. */
export interface ToolContext {
  scene: Scene
  setScene: Dispatch<SetStateAction<Scene>>
  updateLayer: (id: string, patch: Partial<Layer>) => void
  zoom: number
  tab: PanelTab
  selectedId: string | null
  selectedLayer: Layer | undefined
  /** Ends every tool. A tool calls it before turning itself on, so only one is ever active. */
  exclusive: () => void
  /** The editor's view is shown (it stays mounted while the library or settings are open). */
  active: boolean
  /** To the player screen, while the scene is live. */
  send: (t: Transient) => void
  hitTest: (clientX: number, clientY: number) => { id: string; token: boolean } | null
  onError: (message: string) => void
}

type StageEvent = PointerEvent<HTMLDivElement>

/** One family of stage tools. The editor forwards a press to each tool until one takes it. */
export interface Tool {
  /** Crosshair cursor; "Auswählen" is pressed while no tool is active. */
  active: boolean
  /** `p` is the press in scene coordinates. True if the tool took the press; it then gets move and up. */
  down: (e: StageEvent, p: Point) => boolean
  move: (e: StageEvent, p: Point) => void
  up: (e: StageEvent, p: Point) => void
  /** The release never came: drop previews without applying them. */
  cancel: () => void
  /** Turn the tool off. */
  reset: () => void
  /** Drawn in scene coordinates above the scene. */
  overlay: ReactNode
}
