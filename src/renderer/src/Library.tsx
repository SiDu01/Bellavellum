import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { ASSET_KINDS, type AppInfo, type Asset, type AssetKind } from '../../shared/types'
import { Icon } from './controls'
import { PdfImport } from './PdfImport'
import { makeThumb } from './thumbs'

export const LABELS: Record<AssetKind, string> = { maps: 'Karten', props: 'Props', tokens: 'Tokens', effects: 'Effekte' }
const ICONS: Record<AssetKind, string> = { maps: 'map', props: 'chair', tokens: 'person', effects: 'auto_awesome' }
const ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.ico,.gif,.webm,.mp4,.pdf'
const isPdf = (f: File) => /\.pdf$/i.test(f.name)

export function Library({ info }: { info: AppInfo | null }) {
  const lib = window.bellavellum.library
  const [kind, setKind] = useState<AssetKind>('maps')
  const [assets, setAssets] = useState<Asset[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [pdfQueue, setPdfQueue] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const failedThumbs = useRef(new Set<string>())
  const input = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => setAssets(await lib.list()), [lib])
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Covers fresh imports and files copied onto the stick by hand.
  useEffect(() => {
    const missing = assets.filter((a) => !a.thumbUrl && !failedThumbs.current.has(a.url))
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      for (const a of missing) {
        if (cancelled) return
        try {
          await lib.saveThumb(a.kind, a.name, await makeThumb(a.url, a.name))
        } catch {
          failedThumbs.current.add(a.url)
        }
      }
      if (!cancelled) await refresh()
    })()
    return () => {
      cancelled = true
    }
  }, [assets, lib, refresh])

  async function addFiles(files: File[]) {
    const pdfs = files.filter(isPdf)
    const others = files.filter((f) => !isPdf(f))
    if (others.length > 0) {
      try {
        const { rejected, duplicates } = await lib.import(kind, others.map((f) => window.bellavellum.pathForFile(f)))
        if (rejected.length > 0) setErrors((e) => [...e, `Format nicht unterstützt: ${rejected.join(', ')}`])
        if (duplicates.length > 0) {
          const list = duplicates.map((d) => (d.name === d.existing ? d.name : `${d.name} (als ${d.existing})`))
          setErrors((e) => [...e, `Schon vorhanden, nicht erneut importiert: ${list.join(', ')}`])
        }
      } catch (err) {
        setErrors((e) => [...e, `Import fehlgeschlagen: ${String(err)}`])
      }
      await refresh()
    }
    setPdfQueue((q) => [...q, ...pdfs])
  }

  const pdfDone = useCallback(
    (error?: string) => {
      if (error) setErrors((e) => [...e, error])
      setPdfQueue((q) => q.slice(1))
      void refresh()
    },
    [refresh]
  )

  async function remove(a: Asset) {
    try {
      await lib.remove(a.kind, a.name)
    } catch (err) {
      setErrors((e) => [...e, `Löschen fehlgeschlagen: ${String(err)}`])
    }
    await refresh()
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void addFiles([...e.dataTransfer.files])
  }

  const shown = assets.filter((a) => a.kind === kind)
  const pdf = pdfQueue[0]

  return (
    <section
      className={dragging ? 'library dragging' : 'library'}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <div className="library-head">
        <h1>Bibliothek</h1>
        {info && (
          <span className="info" title={info.dataDir}>
            {info.dataDir} · {info.displayCount} {info.displayCount === 1 ? 'Display' : 'Displays'}
          </span>
        )}
      </div>
      <div className="toolbar">
        <div role="tablist" aria-label="Kategorie">
          {ASSET_KINDS.map((k) => (
            <button key={k} role="tab" aria-selected={k === kind} onClick={() => setKind(k)}>
              <Icon name={ICONS[k]} />
              {LABELS[k]} · {assets.filter((a) => a.kind === k).length}
            </button>
          ))}
        </div>
        <button
          className="fab"
          aria-label="Dateien hinzufügen"
          title="Dateien hinzufügen"
          onClick={() => input.current?.click()}
        >
          <Icon name="upload" />
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="errors" role="alert">
          <div>
            {errors.map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
          </div>
          <button className="icon-btn" aria-label="Meldungen schließen" onClick={() => setErrors([])}>
            <Icon name="close" />
          </button>
        </div>
      )}

      <ul className="grid">
        {shown.map((a) => (
          <li key={a.url} className="tile">
            {a.thumbUrl ? <img src={a.thumbUrl} alt="" /> : <div className="no-thumb" aria-hidden="true" />}
            <span className="name" title={a.name}>
              {a.name}
            </span>
            <button
              className="icon-btn remove"
              aria-label={`${a.name} in den Papierkorb`}
              title="In den Papierkorb"
              onClick={() => confirm(`„${a.name}“ in den Papierkorb?`) && void remove(a)}
            >
              <Icon name="delete" />
            </button>
          </li>
        ))}
        <li>
          <button className="drop-card" onClick={() => input.current?.click()}>
            <Icon name="file_upload" />
            {shown.length === 0 ? `Noch keine ${LABELS[kind]}. Dateien hierher ziehen` : 'Dateien hierher ziehen'}
            <small>PNG, JPG, WebP, SVG, ICO, GIF, WebM, MP4, PDF</small>
          </button>
        </li>
      </ul>

      {pdf && <PdfImport key={`${pdf.name}-${pdf.lastModified}`} file={pdf} kind={kind} onDone={pdfDone} />}
    </section>
  )
}
