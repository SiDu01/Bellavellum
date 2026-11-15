export interface AppInfo {
  dataDir: string
  displayCount: number
}

export interface Size {
  width: number
  height: number
}

export interface DisplayInfo {
  id: number
  label: string
  /** Size in DIP, as the OS reports it. */
  width: number
  height: number
  primary: boolean
  /** The player window is on it. */
  player: boolean
}

export const ASSET_KINDS = ['maps', 'props', 'tokens', 'effects'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export interface Asset {
  kind: AssetKind
  name: string
  url: string
  /** null until the renderer has generated one. */
  thumbUrl: string | null
}

export interface ImportResult {
  imported: string[]
  rejected: string[]
}

export const assetUrl = (kind: AssetKind, name: string): string => `bv://data/assets/${kind}/${encodeURIComponent(name)}`

export const BLEND_MODES = ['normal', 'screen', 'multiply', 'overlay', 'lighten', 'darken'] as const
export type BlendMode = (typeof BLEND_MODES)[number]

/** Fractions (0..1) cut off each side of the asset. */
export interface Crop {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Layer {
  id: string
  kind: AssetKind
  name: string
  /** Natural size of the asset in px, measured when the layer was added. */
  width: number
  height: number
  /** Center in scene coordinates. */
  x: number
  y: number
  scale: number
  /** Degrees. */
  rotation: number
  crop: Crop
  opacity: number
  blend: BlendMode
  visible: boolean
  /** Locked layers cannot be moved, scaled, rotated or cropped, so grid and rooms stay aligned. */
  locked: boolean
}

export interface ViewRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SceneSummary {
  id: string
  name: string
}

export const GRID_TYPES = ['square', 'hex-pointy', 'hex-flat'] as const
export type GridType = (typeof GRID_TYPES)[number]

export interface Grid {
  type: GridType
  /** Square: edge length. Hex: distance between neighboring centers (flat side to flat side). */
  size: number
  /** Square: a cell corner. Hex: a cell center. */
  offsetX: number
  offsetY: number
  /** #rrggbb */
  color: string
  opacity: number
  visible: boolean
  snap: boolean
}

export const DEFAULT_GRID: Grid = {
  type: 'square',
  size: 100,
  offsetX: 0,
  offsetY: 0,
  color: '#000000',
  opacity: 0.5,
  visible: false,
  snap: true
}

export interface Token {
  id: string
  kind: AssetKind
  name: string
  /** Center in scene coordinates. */
  x: number
  y: number
  /** Edge length in grid cells. */
  cells: number
  label: string
  visible: boolean
}

/** The mask itself is data/scenes/<scene-id>.fog.png: black with alpha = fogged. */
export interface Fog {
  enabled: boolean
  /** Scene area the mask covers. Players see nothing outside it. */
  rect: ViewRect
  /** Bumped after each mask save so the player window reloads it. */
  revision: number
}

/** A room the DM painted onto the map, for one-click fog reveal. Never shown to players. */
export interface Room {
  id: string
  name: string
  /** #rrggbb, DM overlay only. */
  color: string
  /** Painted cells as [x, y, size] squares in scene coordinates (top-left corner). */
  squares: [number, number, number][]
}

export interface Scene extends SceneSummary {
  /** Bottom to top. */
  layers: Layer[]
  grid: Grid
  /** Drawn above layers and grid. */
  tokens: Token[]
  /** null until fog was switched on once. */
  fog: Fog | null
  rooms: Room[]
  /** What the players see; null = the whole scene. */
  view: ViewRect | null
}

export interface SceneList {
  scenes: SceneSummary[]
  /** File names that could not be read. */
  broken: string[]
}
