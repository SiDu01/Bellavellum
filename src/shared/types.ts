export interface AppInfo {
  dataDir: string
  displayCount: number
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
