import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { baseOf, joinPath, movedPath, parentOf } from '../../shared/assetPaths'
import { ASSET_KINDS, type AppInfo, type Asset, type AssetKind, type LibraryList, type ScanResult } from '../../shared/types'
import { Icon } from './controls'
import { useConfirm, usePrompt } from './Dialog'
import { ImportDialog } from './ImportDialog'
import { nameProblem, splitExt } from './names'
import { PdfImport } from './PdfImport'
import { makeThumb } from './thumbs'

export const LABELS: Record<AssetKind, string> = { maps: 'Karten', props: 'Props', tokens: 'Tokens', effects: 'Effekte' }
const ICONS: Record<AssetKind, string> = { maps: 'map', props: 'chair', tokens: 'person', effects: 'auto_awesome' }
const ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.ico,.gif,.webm,.mp4,.pdf,.zip'
const isPdf = (f: File) => /\.pdf$/i.test(f.name)
/** Drag type of a library file or folder being moved; anything else dropped is an import. */
const MOVE_TYPE = 'application/x-bellavellum-path'
const EMPTY: LibraryList = { assets: [], folders: [] }

/** Subfolders and assets directly in `folder` ('' is the category's top level). */
export function inFolder(list: LibraryList, kind: AssetKind, folder: string): { folders: string[]; assets: Asset[] } {
  return {
    folders: list.folders.filter((f) => f.kind === kind && parentOf(f.path) === folder).map((f) => f.path),
    assets: list.assets.filter((a) => a.kind === kind && parentOf(a.name) === folder)
  }
}

interface CrumbsProps {
  kind: AssetKind
  folder: string
  onOpen: (folder: string) => void
  /** Makes each crumb a drop target for moving files and folders. */
  dropProps?: (folder: string) => { className?: string }
}

export function Crumbs({ kind, folder, onOpen, dropProps }: CrumbsProps) {
  const parts = folder ? folder.split('/') : []
  const paths = ['', ...parts.map((_, i) => parts.slice(0, i + 1).join('/'))]
  return (
    <nav className="crumbs" aria-label="Ordner">
      {paths.map((p, i) => {
        const drop = dropProps?.(p)
        return (
          <span key={p}>
            {i > 0 && <Icon name="chevron_right" />}
            <button
              {...drop}
              className={drop?.className ? `text ${drop.className}` : 'text'}
              aria-current={p === folder ? 'location' : undefined}
              onClick={() => onOpen(p)}
            >
              {p === '' ? LABELS[kind] : baseOf(p)}
            </button>
          </span>
        )
      })}
    </nav>
  )
}

export function Library({ active, info }: { active: boolean; info: AppInfo | null }) {
  const lib = window.bellavellum.library
  const [kind, setKind] = useState<AssetKind>('maps')
  const [folder, setFolder] = useState('')
  const [list, setList] = useState<LibraryList>(EMPTY)
  const [errors, setErrors] = useState<string[]>([])
  const [pdfQueue, setPdfQueue] = useState<File[]>([])
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const failedThumbs = useRef(new Set<string>())
  const input = useRef<HTMLInputElement>(null)
  const [confirmDialog, ask] = useConfirm()
  const [promptDialog, prompt] = usePrompt()
  const report = (msg: string) => setErrors((e) => [...e, msg])

  const refresh = useCallback(async () => setList(await lib.list()), [lib])
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Covers fresh imports and files copied onto the stick by hand.
  useEffect(() => {
    const missing = list.assets.filter((a) => !a.thumbUrl && !failedThumbs.current.has(a.url))
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
  }, [list, lib, refresh])

  async function scanPaths(paths: string[]) {
    if (paths.length === 0) return
    try {
      const result = await lib.scan(paths)
      if (result.files.length > 0) setScan(result)
      else report(`Nichts zum Importieren gefunden${result.skipped.length > 0 ? `: ${result.skipped.join(', ')}` : ''}`)
    } catch (err) {
      report(`Import fehlgeschlagen: ${String(err)}`)
    }
  }

  function addFiles(files: File[]) {
    setPdfQueue((q) => [...q, ...files.filter(isPdf)])
    void scanPaths(files.filter((f) => !isPdf(f)).map((f) => window.bellavellum.pathForFile(f)))
  }

  const pdfDone = useCallback(
    (error?: string) => {
      if (error) setErrors((e) => [...e, error])
      setPdfQueue((q) => q.slice(1))
      void refresh()
    },
    [refresh]
  )

  async function remove(path: string) {
    try {
      await lib.remove(kind, path)
    } catch (err) {
      report(`Löschen fehlgeschlagen: ${String(err)}`)
    }
    await refresh()
  }

  async function move(from: string, to: string) {
    if (from === to) return
    try {
      await lib.move(kind, from, to)
    } catch (err) {
      report(`Verschieben fehlgeschlagen: ${String(err)}`)
    }
    await refresh()
  }

  const validName = (value: string) => nameProblem(value.trim())

  function renameAsset(a: Asset) {
    const [stem, ext] = splitExt(baseOf(a.name))
    prompt({
      title: 'Umbenennen',
      label: `Name (${ext} bleibt)`,
      initial: stem,
      action: 'Umbenennen',
      validate: (v) => validName(v + ext),
      onSubmit: (v) => void move(a.name, joinPath(parentOf(a.name), v.trim() + ext))
    })
  }

  function renameFolder(path: string) {
    prompt({
      title: 'Ordner umbenennen',
      label: 'Name',
      initial: baseOf(path),
      action: 'Umbenennen',
      validate: validName,
      onSubmit: (v) => void move(path, joinPath(parentOf(path), v.trim()))
    })
  }

  function newFolder() {
    prompt({
      title: 'Neuer Ordner',
      label: 'Name',
      initial: '',
      action: 'Anlegen',
      validate: validName,
      onSubmit: (v) =>
        void lib
          .mkdir(kind, joinPath(folder, v.trim()))
          .catch((err: unknown) => report(`Ordner nicht angelegt: ${String(err)}`))
          .then(refresh)
    })
  }

  /** Drop target for moving library files and folders into `target`. */
  const dropProps = (target: string) => ({
    className: dropTarget === target ? 'drop-target' : undefined,
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(MOVE_TYPE)) return
      e.preventDefault()
      e.stopPropagation()
      setDropTarget(target)
    },
    onDragLeave: () => setDropTarget((t) => (t === target ? null : t)),
    onDrop: (e: DragEvent) => {
      const from = e.dataTransfer.getData(MOVE_TYPE)
      if (!from) return
      e.preventDefault()
      e.stopPropagation()
      setDropTarget(null)
      // Into itself or its own subfolder is refused by main too; here it is just a no-op.
      if (parentOf(from) !== target && movedPath(target, from, '') === null) void move(from, joinPath(target, baseOf(from)))
    }
  })
  const dragProps = (path: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(MOVE_TYPE, path)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => setDropTarget(null)
  })

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.types.includes('Files')) addFiles([...e.dataTransfer.files])
  }

  const shown = inFolder(list, kind, folder)
  const pdf = pdfQueue[0]
  const filesIn = (path: string) => list.assets.filter((a) => a.kind === kind && movedPath(a.name, path, '') !== null).length

  return (
    <section
      className={dragging ? 'library dragging' : 'library'}
      hidden={!active}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
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
            <button
              key={k}
              role="tab"
              aria-selected={k === kind}
              onClick={() => {
                setKind(k)
                setFolder('')
              }}
            >
              <Icon name={ICONS[k]} />
              {LABELS[k]} · {list.assets.filter((a) => a.kind === k).length}
            </button>
          ))}
        </div>
        <button className="fab" aria-label="Dateien oder ZIP hinzufügen" title="Dateien oder ZIP hinzufügen" onClick={() => input.current?.click()}>
          <Icon name="upload" />
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      <div className="library-nav">
        <Crumbs kind={kind} folder={folder} onOpen={setFolder} dropProps={dropProps} />
        <button className="text" onClick={newFolder}>
          <Icon name="create_new_folder" />
          Neuer Ordner
        </button>
        <button className="text" onClick={() => void lib.pickFolders().then(scanPaths)}>
          <Icon name="drive_folder_upload" />
          Ordner importieren
        </button>
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
        {shown.folders.map((path) => {
          const drop = dropProps(path)
          return (
            <li key={path} {...drop} {...dragProps(path)} className={drop.className ? 'tile folder drop-target' : 'tile folder'}>
              <button className="open" onClick={() => setFolder(path)}>
                <Icon name="folder" />
                <span className="name" title={path}>
                  {baseOf(path)}
                </span>
                <small>{filesIn(path)} Dateien</small>
              </button>
              <div className="actions">
                <button className="icon-btn" aria-label={`${baseOf(path)} umbenennen`} title="Umbenennen" onClick={() => renameFolder(path)}>
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`${baseOf(path)} in den Papierkorb`}
                  title="In den Papierkorb"
                  onClick={() =>
                    ask({
                      title: `Ordner „${baseOf(path)}“ in den Papierkorb?`,
                      text: `Mit ${filesIn(path)} Dateien. Szenen, die sie nutzen, zeigen sie danach nicht mehr.`,
                      action: 'In den Papierkorb',
                      onConfirm: () => void remove(path)
                    })
                  }
                >
                  <Icon name="delete" />
                </button>
              </div>
            </li>
          )
        })}
        {shown.assets.map((a) => (
          <li key={a.url} className="tile" {...dragProps(a.name)}>
            {a.thumbUrl ? <img src={a.thumbUrl} alt="" draggable={false} /> : <div className="no-thumb" aria-hidden="true" />}
            <span className="name" title={a.name}>
              {baseOf(a.name)}
            </span>
            <div className="actions">
              <button className="icon-btn" aria-label={`${baseOf(a.name)} umbenennen`} title="Umbenennen" onClick={() => renameAsset(a)}>
                <Icon name="edit" />
              </button>
              <button
                className="icon-btn"
                aria-label={`${baseOf(a.name)} in den Papierkorb`}
                title="In den Papierkorb"
                onClick={() =>
                  ask({ title: `„${baseOf(a.name)}“ in den Papierkorb?`, action: 'In den Papierkorb', onConfirm: () => void remove(a.name) })
                }
              >
                <Icon name="delete" />
              </button>
            </div>
          </li>
        ))}
        <li>
          <button className="drop-card" onClick={() => input.current?.click()}>
            <Icon name="file_upload" />
            {shown.assets.length + shown.folders.length === 0 ? `Noch keine ${LABELS[kind]}. Dateien, Ordner oder ZIP hierher ziehen` : 'Dateien, Ordner oder ZIP hierher ziehen'}
            <small>PNG, JPG, WebP, SVG, ICO, GIF, WebM, MP4, PDF, ZIP</small>
          </button>
        </li>
      </ul>

      {confirmDialog}
      {promptDialog}
      {scan && (
        <ImportDialog
          scan={scan}
          library={list}
          initialKind={kind}
          initialFolder={folder}
          onClose={() => setScan(null)}
          onDone={(messages) => {
            setScan(null)
            setErrors((e) => [...e, ...messages])
            void refresh()
          }}
        />
      )}
      {pdf && <PdfImport key={`${pdf.name}-${pdf.lastModified}`} file={pdf} kind={kind} folder={folder} onDone={pdfDone} />}
    </section>
  )
}
