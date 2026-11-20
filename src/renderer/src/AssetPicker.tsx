import { useEffect, useState } from 'react'
import { baseOf } from '../../shared/assetPaths'
import { ASSET_KINDS, type Asset, type AssetKind, type LibraryList } from '../../shared/types'
import { Icon } from './controls'
import { Modal } from './Dialog'
import { Crumbs, inFolder, LABELS } from './Library'

interface Props {
  title: string
  initialKind: AssetKind
  onPick: (asset: Asset) => void
  onClose: () => void
}

export function AssetPicker({ title, initialKind, onPick, onClose }: Props) {
  const [kind, setKind] = useState<AssetKind>(initialKind)
  const [folder, setFolder] = useState('')
  const [list, setList] = useState<LibraryList>({ assets: [], folders: [] })

  useEffect(() => {
    void window.bellavellum.library.list().then(setList)
  }, [])

  const shown = inFolder(list, kind, folder)
  return (
    <Modal label={title} onClose={onClose}>
      <h2>{title}</h2>
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
            {LABELS[k]}
          </button>
        ))}
      </div>
      <Crumbs kind={kind} folder={folder} onOpen={setFolder} />
      {/* One scroll area for folders and files, so the dialog never grows past the window. */}
      <div className="picker-scroll">
        {shown.folders.length > 0 && (
          <ul className="folder-list" aria-label="Ordner">
            {shown.folders.map((path) => (
              <li key={path}>
                <button onClick={() => setFolder(path)}>
                  <Icon name="folder" />
                  <span className="name">{baseOf(path)}</span>
                  <Icon name="chevron_right" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {shown.assets.length > 0 ? (
          <ul className="grid picker">
            {shown.assets.map((a) => (
              <li key={a.url} className="tile">
                <button className="pick" onClick={() => onPick(a)}>
                  {a.thumbUrl ? <img src={a.thumbUrl} alt="" /> : <div className="no-thumb" aria-hidden="true" />}
                  <span className="name">{baseOf(a.name)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          shown.folders.length === 0 && (
            <p className="empty">
              Keine {LABELS[kind]} {folder ? 'in diesem Ordner' : 'in der Bibliothek'}.
            </p>
          )
        )}
      </div>
      <div className="modal-actions">
        <button onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  )
}
