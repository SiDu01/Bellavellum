import { dataUrl, type ViewRect } from '../../shared/types.ts'

/** Fog does not need map resolution; this keeps masks small on the stick. */
const MAX_MASK_SIDE = 2048

export function maskScale(rect: ViewRect): number {
  return Math.min(1, MAX_MASK_SIDE / Math.max(rect.width, rect.height))
}

export function maskSize(rect: ViewRect): { width: number; height: number } {
  const s = maskScale(rect)
  return { width: Math.max(1, Math.round(rect.width * s)), height: Math.max(1, Math.round(rect.height * s)) }
}

/** Scene point to mask pixel. */
export function toMask(rect: ViewRect, x: number, y: number): { x: number; y: number } {
  const s = maskScale(rect)
  return { x: (x - rect.x) * s, y: (y - rect.y) * s }
}

export const fogUrl = (sceneId: string, version: number): string => `${dataUrl('scenes', `${sceneId}.fog.png`)}?v=${version}`

export type FogMode = 'reveal' | 'hide'

function prepare(ctx: CanvasRenderingContext2D, mode: FogMode): void {
  ctx.globalCompositeOperation = mode === 'reveal' ? 'destination-out' : 'source-over'
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
}

/** Brush segment in mask pixels; a dot when from === to. */
export function paintLine(
  ctx: CanvasRenderingContext2D,
  mode: FogMode,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number
): void {
  prepare(ctx, mode)
  ctx.lineCap = 'round'
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x + (from.x === to.x && from.y === to.y ? 0.01 : 0), to.y)
  ctx.stroke()
}

export function paintRect(ctx: CanvasRenderingContext2D, mode: FogMode, r: ViewRect): void {
  prepare(ctx, mode)
  ctx.fillRect(r.x, r.y, r.width, r.height)
}

/** A whole mask, fully fogged or fully clear, as PNG bytes. */
export async function solidMask(rect: ViewRect, fogged: boolean): Promise<Uint8Array> {
  const { width, height } = maskSize(rect)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  if (fogged) paintRect(ctx, 'hide', { x: 0, y: 0, width, height })
  return canvasToPng(canvas)
}

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Fog-Maske konnte nicht erzeugt werden')
  return new Uint8Array(await blob.arrayBuffer())
}
