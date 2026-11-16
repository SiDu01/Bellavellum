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
  /** Not copied: the same content is already in the category under `existing`. */
  duplicates: { name: string; existing: string }[]
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
  /** Grids printed on parts of this layer; they move, scale and rotate with it. */
  grids: LocalGrid[]
  /** Areas of effect placed on this layer; hidden with it. */
  areas: Area[]
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

/**
 * A grid printed on one part of a layer, e.g. a rotated inset map. Size, offset and region are in
 * the layer's own px (unscaled, origin at its top-left corner), turned by `rotation` around that corner.
 */
export interface LocalGrid extends Grid {
  id: string
  /** Degrees, relative to the layer. */
  rotation: number
  /** The part of the layer it covers, in the turned plane. */
  region: ViewRect
}

export const AREA_SHAPES = ['ruler', 'burst', 'cone', 'line'] as const
export type AreaShape = (typeof AREA_SHAPES)[number]

/** A Pathfinder 2e area of effect, or a measured distance. */
export interface Area {
  id: string
  shape: AreaShape
  /** Origin and the point dragged to, in the owning layer's own px (scene coordinates without a layer). */
  x: number
  y: number
  tx: number
  ty: number
  /** Burst started on a token: edge length of its space in cells, counted from its edge. 1 otherwise. */
  size: number
  /** Players see it. The DM always does. */
  visible: boolean
}

/** Short-lived DM input mirrored to the player window, never saved. Scene coordinates. */
export type Transient =
  | { type: 'ping'; x: number; y: number }
  | { type: 'pointer'; x: number; y: number }
  | { type: 'pointer-end' }
  | { type: 'measure'; layerId: string | null; area: Area | null }

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
