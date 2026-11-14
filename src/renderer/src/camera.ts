import type { Layer, ViewRect } from '../../shared/types'

/** Scene point shown at the center of the screen, and px per scene unit. */
export interface Camera {
  x: number
  y: number
  zoom: number
}

const MIN_ZOOM = 0.02
const MAX_ZOOM = 20
const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export function fitCamera(rect: ViewRect, width: number, height: number, padding = 1): Camera {
  const zoom = Math.min(width / rect.width, height / rect.height) * padding
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, zoom: clampZoom(zoom) }
}

export function visibleRect(cam: Camera, width: number, height: number): ViewRect {
  const w = width / cam.zoom
  const h = height / cam.zoom
  return { x: cam.x - w / 2, y: cam.y - h / 2, width: w, height: h }
}

/** sx, sy in px from the stage's top left. */
export function screenToWorld(cam: Camera, sx: number, sy: number, width: number, height: number): { x: number; y: number } {
  return { x: cam.x + (sx - width / 2) / cam.zoom, y: cam.y + (sy - height / 2) / cam.zoom }
}

/** Zoom while keeping the scene point under the cursor (sx, sy in px from the stage's top left) in place. */
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number, width: number, height: number): Camera {
  const zoom = clampZoom(cam.zoom * factor)
  const px = cam.x + (sx - width / 2) / cam.zoom
  const py = cam.y + (sy - height / 2) / cam.zoom
  return { x: px - (sx - width / 2) / zoom, y: py - (sy - height / 2) / zoom, zoom }
}

/** Axis-aligned bounds of the cropped, scaled and rotated layer. */
export function layerBounds(l: Layer): ViewRect {
  const x0 = (-0.5 + l.crop.left) * l.width
  const x1 = (0.5 - l.crop.right) * l.width
  const y0 = (-0.5 + l.crop.top) * l.height
  const y1 = (0.5 - l.crop.bottom) * l.height
  const rad = (l.rotation * Math.PI) / 180
  const cos = Math.cos(rad) * l.scale
  const sin = Math.sin(rad) * l.scale
  const corners = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ].map(([x = 0, y = 0]) => [l.x + x * cos - y * sin, l.y + x * sin + y * cos])
  const xs = corners.map((c) => c[0] ?? 0)
  const ys = corners.map((c) => c[1] ?? 0)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

export function sceneBounds(layers: Layer[]): ViewRect | null {
  const rects = layers.filter((l) => l.visible).map(layerBounds)
  if (rects.length === 0) return null
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
