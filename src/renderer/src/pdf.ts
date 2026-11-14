import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { canvasToBytes } from './thumbs'

GlobalWorkerOptions.workerSrc = workerUrl

/** Longest side of an imported page. Enough for a battlemap on a 4K TV. */
const IMPORT_SIZE = 4096
const PREVIEW_SIZE = 200

/** Call destroy() on the task to free the worker. */
export function openPdf(data: ArrayBuffer): PDFDocumentLoadingTask {
  return getDocument({ data })
}

async function renderPage(doc: PDFDocumentProxy, pageNumber: number, longestSide: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: longestSide / Math.max(base.width, base.height) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  await page.render({ canvasContext: ctx, canvas, viewport }).promise
  page.cleanup()
  return canvas
}

export async function renderPreview(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  return (await renderPage(doc, pageNumber, PREVIEW_SIZE)).toDataURL('image/png')
}

export async function renderForImport(doc: PDFDocumentProxy, pageNumber: number): Promise<Uint8Array> {
  return canvasToBytes(await renderPage(doc, pageNumber, IMPORT_SIZE), 'image/png')
}
