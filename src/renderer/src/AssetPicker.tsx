import { useEffect, useState } from 'react'
import { ASSET_KINDS, type Asset, type AssetKind } from '../../shared/types'
import { Modal } from './Dialog'
import { LABELS } from './Library'

interface Props {
  title: string
  initialKind: AssetKind
  onPick: (asset: Asset) => void
  onClose: () => void
}

export function AssetPicker({ title, initialKind, onPick, onClose }: Props) {
  const [kind, setKind] = useState<AssetKind>(initialKind)
  const [assets, setAssets] = useState<Asset[]>([])

  useEffect(() => {
    void window.bellavellum.library.list().then(setAssets)
  }, [])

  const shown = assets.filter((a) => a.kind === kind)
  return (
    <Modal label={title} onClose={onClose}>
      <h2>{title}</h2>
      <div role="tablist" aria-label="Kategorie">
        {ASSET_KINDS.map((k) => (
          <button key={k} role="tab" aria-selected={k === kind} onClick={() => setKind(k)}>
            {LABELS[k]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="empty">Keine {LABELS[kind]} in der Bibliothek.</p>
      ) : (
        <ul className="grid picker">
          {shown.map((a) => (
            <li key={a.url} className="tile">
              <button className="pick" onClick={() => onPick(a)}>
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" /> : <div className="no-thumb" aria-hidden="true" />}
                <span className="name">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        <button onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  )
}
