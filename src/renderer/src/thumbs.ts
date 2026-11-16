import { assetUrl, type Layer } from '../../shared/types'

const MAX = 320

export const isVideo = (name: string): boolean => /\.(webm|mp4)$/i.test(name)

interface Source {
  el: CanvasImageSource
  w: number
  h: number
}

async function loadImage(url: string): Promise<Source> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  // SVGs without width/height report 0.
  return { el: img, w: img.naturalWidth || MAX, h: img.naturalHeight || MAX }
}

async function loadVideo(url: string): Promise<Source> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'auto'
  video.src = url
  // Broken files sometimes fire neither event; without the timeout the thumbnail queue would hang.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Video lädt nicht')), 15000)
    video.onloadeddata = () => {
      clearTimeout(timer)
      resolve()
    }
    video.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Video konnte nicht geladen werden'))
    }
  })
  return { el: video, w: video.videoWidth, h: video.videoHeight }
}

export async function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  if (!blob) throw new Error('Bild konnte nicht erzeugt werden')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * RGBA pixels of `region` in a grid plane (layer turned by -rotation), scaled so the longer side is
 * at most `maxSide`. Only the layer's `visible` part (layer px) is drawn: split parts share one image.
 * `scale` is pixels per layer px.
 */
export async function planePixels(
  url: string,
  l: Pick<Layer, 'width' | 'height'>,
  rotation: number,
  region: { x: number; y: number; width: number; height: number },
  visible: { x: number; y: number; width: number; height: number },
  maxSide: number
): Promise<{ data: Uint8ClampedArray; width: number; height: number; scale: number }> {
  const { el } = await loadImage(url)
  const scale = Math.min(1, maxSide / Math.max(region.width, region.height))
  const width = Math.max(1, Math.round(region.width * scale))
  const height = Math.max(1, Math.round(region.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  ctx.scale(scale, scale)
  ctx.translate(-region.x, -region.y)
  ctx.rotate((-rotation * Math.PI) / 180)
  ctx.beginPath()
  ctx.rect(visible.x, visible.y, visible.width, visible.height)
  ctx.clip()
  ctx.drawImage(el, 0, 0, l.width, l.height)
  return { data: ctx.getImageData(0, 0, width, height).data, width, height, scale }
}

/** The layer's visible part at the size it was measured with, as PNG. */
export async function cropToPng(url: string, l: Pick<Layer, 'width' | 'height' | 'crop'>): Promise<Uint8Array> {
  const { el } = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(l.width * (1 - l.crop.left - l.crop.right)))
  canvas.height = Math.max(1, Math.round(l.height * (1 - l.crop.top - l.crop.bottom)))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  ctx.drawImage(el, -l.crop.left * l.width, -l.crop.top * l.height, l.width, l.height)
  return canvasToBytes(canvas, 'image/png')
}

/**
 * Mean color of the inner part of each square (cell edges are often grid or wall lines), from the
 * visible normal-blend image layers as the DM sees them. Videos and effects are skipped.
 */
export async function squareColors(
  layers: Layer[],
  squares: [number, number, number][],
  maxSide = 2048
): Promise<[number, number, number][]> {
  if (squares.length === 0) return []
  const bx = Math.min(...squares.map((q) => q[0]))
  const by = Math.min(...squares.map((q) => q[1]))
  const bw = Math.max(...squares.map((q) => q[0] + q[2])) - bx
  const bh = Math.max(...squares.map((q) => q[1] + q[2])) - by
  const k = Math.min(1, maxSide / Math.max(bw, bh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(bw * k))
  canvas.height = Math.max(1, Math.ceil(bh * k))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  for (const l of layers) {
    if (!l.visible || l.blend !== 'normal' || isVideo(l.name)) continue
    const { el } = await loadImage(assetUrl(l.kind, l.name))
    ctx.setTransform(k, 0, 0, k, -bx * k, -by * k)
    ctx.translate(l.x, l.y)
    ctx.rotate((l.rotation * Math.PI) / 180)
    ctx.scale(l.scale, l.scale)
    ctx.globalAlpha = l.opacity
    ctx.save()
    const x0 = (-0.5 + l.crop.left) * l.width
    const y0 = (-0.5 + l.crop.top) * l.height
    ctx.beginPath()
    ctx.rect(x0, y0, (1 - l.crop.left - l.crop.right) * l.width, (1 - l.crop.top - l.crop.bottom) * l.height)
    ctx.clip()
    ctx.drawImage(el, -l.width / 2, -l.height / 2, l.width, l.height)
    ctx.restore()
  }
  const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return squares.map(([x, y, s]) => {
    const sum = [0, 0, 0]
    let n = 0
    const px0 = Math.floor((x + s * 0.2 - bx) * k)
    const py0 = Math.floor((y + s * 0.2 - by) * k)
    const px1 = Math.max(px0 + 1, Math.ceil((x + s * 0.8 - bx) * k))
    const py1 = Math.max(py0 + 1, Math.ceil((y + s * 0.8 - by) * k))
    for (let py = py0; py < py1; py++) {
      for (let px = px0; px < px1; px++) {
        const i = (py * width + px) * 4
        // Nothing drawn there is the black stage background.
        const a = (data[i + 3] ?? 0) / 255
        for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (data[i + c] ?? 0) * a
        n++
      }
    }
    return [(sum[0] ?? 0) / n, (sum[1] ?? 0) / n, (sum[2] ?? 0) / n]
  })
}

export async function measure(url: string, name: string): Promise<{ width: number; height: number }> {
  const { w, h } = isVideo(name) ? await loadVideo(url) : await loadImage(url)
  return { width: w, height: h }
}

export async function makeThumb(url: string, name: string): Promise<Uint8Array> {
  const { el, w, h } = isVideo(name) ? await loadVideo(url) : await loadImage(url)
  const scale = Math.min(1, MAX / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
  return canvasToBytes(canvas, 'image/webp', 0.8)
}
