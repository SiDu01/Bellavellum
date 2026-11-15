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

/** RGBA pixels of an image, scaled down so the longer side is at most `maxSide`. */
export async function imagePixels(
  url: string,
  maxSide: number
): Promise<{ data: Uint8ClampedArray; width: number; height: number; scale: number }> {
  const { el, w, h } = await loadImage(url)
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const width = Math.max(1, Math.round(w * scale))
  const height = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  ctx.drawImage(el, 0, 0, width, height)
  return { data: ctx.getImageData(0, 0, width, height).data, width, height, scale }
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
