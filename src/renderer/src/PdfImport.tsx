import { useEffect, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { AssetKind } from '../../shared/types'
import { openPdf, renderForImport, renderPreview } from './pdf'

interface Props {
  file: File
  kind: AssetKind
  onDone: (error?: string) => void
}

export function PdfImport({ file, kind, onDone }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loaded: { task?: PDFDocumentLoadingTask } = {}
    void (async () => {
      try {
        loaded.task = openPdf(await file.arrayBuffer())
        const opened = await loaded.task.promise
        if (cancelled) return
        setDoc(opened)
        for (let n = 1; n <= opened.numPages && !cancelled; n++) {
          const url = await renderPreview(opened, n)
          if (!cancelled) setPreviews((p) => [...p, url])
        }
      } catch (err) {
        if (!cancelled) onDone(`${file.name}: ${String(err)}`)
      }
    })()
    return () => {
      cancelled = true
      void loaded.task?.destroy()
    }
  }, [file, onDone])

  const toggle = (n: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (!next.delete(n)) next.add(n)
      return next
    })

  async function importSelected() {
    if (!doc) return
    const stem = file.name.replace(/\.pdf$/i, '')
    const pages = [...selected].sort((a, b) => a - b)
    const duplicates: string[] = []
    try {
      for (const [i, n] of pages.entries()) {
        setProgress(`Seite ${n} wird importiert (${i + 1}/${pages.length})…`)
        const saved = await window.bellavellum.library.save(kind, `${stem} S${n}.png`, await renderForImport(doc, n))
        if (saved.duplicate) duplicates.push(`S${n} (als ${saved.name})`)
      }
      onDone(duplicates.length > 0 ? `${file.name}: schon vorhanden, nicht erneut importiert: ${duplicates.join(', ')}` : undefined)
    } catch (err) {
      onDone(`${file.name}: ${String(err)}`)
    }
  }

  const total = doc?.numPages ?? 0
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`PDF importieren: ${file.name}`}>
      <div className="modal-body">
        <h2>{file.name}</h2>
        <p>
          Seiten auswählen ({previews.length}/{total || '…'} geladen)
        </p>
        <div className="pdf-pages">
          {previews.map((url, i) => (
            <label key={i} className={selected.has(i + 1) ? 'pdf-page selected' : 'pdf-page'}>
              <input type="checkbox" checked={selected.has(i + 1)} onChange={() => toggle(i + 1)} />
              <img src={url} alt="" />
              <span>Seite {i + 1}</span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          {progress && <span>{progress}</span>}
          <button onClick={() => onDone()} disabled={progress !== null}>
            Abbrechen
          </button>
          <button onClick={() => void importSelected()} disabled={selected.size === 0 || progress !== null}>
            {selected.size} {selected.size === 1 ? 'Seite' : 'Seiten'} importieren
          </button>
        </div>
      </div>
    </div>
  )
}
