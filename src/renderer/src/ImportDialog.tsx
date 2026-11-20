import { useMemo, useState } from 'react'
import { baseOf, joinPath, parentOf } from '../../shared/assetPaths'
import { ASSET_KINDS, type AssetKind, type ImportSource, type LibraryList, type ScanResult } from '../../shared/types'
import { Modal } from './Dialog'
import { LABELS } from './Library'
import { cleanName, nameProblem, splitExt } from './names'

interface Row {
  source: ImportSource
  folder0: string
  stem0: string
  ext: string
  include: boolean
  /** Set once the DM edits it; otherwise follows the "clean names" switch. */
  folder?: string
  stem?: string
}

interface Props {
  scan: ScanResult
  library: LibraryList
  initialKind: AssetKind
  initialFolder: string
  /** Messages for the library's error list. */
  onDone: (messages: string[]) => void
  onClose: () => void
}

const cleanFolder = (folder: string): string => folder.split('/').map(cleanName).join('/')

export function ImportDialog({ scan, library, initialKind, initialFolder, onDone, onClose }: Props) {
  const [kind, setKind] = useState(initialKind)
  const [base, setBase] = useState(initialFolder)
  const [clean, setClean] = useState(true)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Row[]>(() =>
    [...scan.files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(({ source, path }) => {
        const [stem0, ext] = splitExt(baseOf(path))
        return { source, folder0: parentOf(path), stem0, ext, include: true }
      })
  )

  const folderOf = (r: Row): string => r.folder ?? (clean ? cleanFolder(r.folder0) : r.folder0)
  const stemOf = (r: Row): string => r.stem ?? (clean ? cleanName(r.stem0) : r.stem0)
  const targetOf = (r: Row): string => joinPath(base, folderOf(r), stemOf(r) + r.ext)
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const taken = useMemo(
    () => new Set(library.assets.filter((a) => a.kind === kind).map((a) => a.name.toLowerCase())),
    [library, kind]
  )
  const problems = rows.map((r) => {
    if (!r.include) return null
    const segments = joinPath(base, folderOf(r)).split('/').filter(Boolean)
    return [...segments, stemOf(r) + r.ext].map(nameProblem).find(Boolean) ?? null
  })
  const targets = rows.map(targetOf)
  const counts = new Map<string, number>()
  for (const [i, r] of rows.entries()) {
    const t = (targets[i] ?? '').toLowerCase()
    if (r.include) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const conflict = (i: number): boolean => {
    const t = (targets[i] ?? '').toLowerCase()
    return taken.has(t) || (counts.get(t) ?? 0) > 1
  }
  const chosen = rows.filter((r) => r.include)
  const blocked = problems.some(Boolean)

  function replaceAll() {
    if (!find) return
    setRows((rs) => rs.map((r) => ({ ...r, stem: stemOf(r).replaceAll(find, replace) })))
  }

  async function run() {
    setBusy(true)
    const lib = window.bellavellum.library
    const messages: string[] = []
    try {
      const items = rows.filter((r) => r.include).map((r) => ({ source: r.source, path: targetOf(r) }))
      const { rejected, duplicates, failed } = await lib.import(kind, items)
      if (rejected.length > 0) messages.push(`Format nicht unterstützt: ${rejected.join(', ')}`)
      if (failed.length > 0) messages.push(`Konnte nicht importiert werden: ${failed.join(', ')}`)
      if (duplicates.length > 0) {
        const list = duplicates.map((d) => `${baseOf(d.name)} (als ${d.existing})`)
        messages.push(`Schon vorhanden, nicht erneut importiert: ${list.join(', ')}`)
      }
    } catch (err) {
      messages.push(`Import fehlgeschlagen: ${String(err)}`)
    }
    onDone(messages)
  }

  return (
    <Modal label="Importieren" onClose={onClose} busy={busy} className="import">
      <h2>Importieren</h2>
      <p>
        {rows.length} {rows.length === 1 ? 'Datei' : 'Dateien'}
        {scan.skipped.length > 0 && (
          <span title={scan.skipped.join('\n')}> · {scan.skipped.length} übersprungen (kein Bild/Video; PDFs einzeln importieren)</span>
        )}
      </p>
      <div className="import-options">
        <label>
          Kategorie
          <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)} disabled={busy}>
            {ASSET_KINDS.map((k) => (
              <option key={k} value={k}>
                {LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zielordner
          <input value={base} list="import-folders" placeholder="Hauptebene" onChange={(e) => setBase(e.target.value)} disabled={busy} />
          <datalist id="import-folders">
            {library.folders
              .filter((f) => f.kind === kind)
              .map((f) => (
                <option key={f.path} value={f.path} />
              ))}
          </datalist>
        </label>
        <label className="check">
          <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} disabled={busy} />
          Namen bereinigen
        </label>
        <label>
          Suchen
          <input value={find} onChange={(e) => setFind(e.target.value)} disabled={busy} />
        </label>
        <label>
          Ersetzen durch
          <input value={replace} onChange={(e) => setReplace(e.target.value)} disabled={busy} />
        </label>
        <button onClick={replaceAll} disabled={busy || !find}>
          In allen Namen ersetzen
        </button>
      </div>
      <div className="import-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Alle auswählen"
                  checked={chosen.length === rows.length}
                  onChange={(e) => setRows((rs) => rs.map((r) => ({ ...r, include: e.target.checked })))}
                  disabled={busy}
                />
              </th>
              <th>Ordner</th>
              <th>Name</th>
              <th>Quelle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const source = r.source.entry ?? r.source.file
              const problem = problems[i]
              return (
                <tr key={`${r.source.file}|${r.source.entry ?? ''}`} className={r.include ? undefined : 'excluded'}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${stemOf(r)} importieren`}
                      checked={r.include}
                      onChange={(e) => update(i, { include: e.target.checked })}
                      disabled={busy}
                    />
                  </td>
                  <td>
                    <input aria-label="Ordner" value={folderOf(r)} onChange={(e) => update(i, { folder: e.target.value })} disabled={busy} />
                  </td>
                  <td>
                    <span className="import-name">
                      <input
                        aria-label="Name"
                        aria-invalid={problem ? true : undefined}
                        value={stemOf(r)}
                        onChange={(e) => update(i, { stem: e.target.value })}
                        disabled={busy}
                      />
                      <span className="ext">{r.ext}</span>
                    </span>
                    {problem && <small className="problem">{problem}</small>}
                    {!problem && r.include && conflict(i) && <small>Name vergeben, wird nummeriert</small>}
                  </td>
                  <td className="source" title={source}>
                    {baseOf(source.replaceAll('\\', '/'))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="modal-actions">
        {busy && <span className="progress">{chosen.length} Dateien werden importiert…</span>}
        <button onClick={onClose} disabled={busy}>
          Abbrechen
        </button>
        <button className="primary" onClick={() => void run()} disabled={busy || blocked || chosen.length === 0}>
          {chosen.length} importieren
        </button>
      </div>
    </Modal>
  )
}
