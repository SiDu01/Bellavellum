import { useEffect, useState } from 'react'
import { ASSET_KINDS, type Asset, type AssetKind } from '../../shared/types'
import { LABELS } from './Library'

interface Props {
  onPick: (asset: Asset) => void
  onClose: () => void
}

export function AssetPicker({ onPick, onClose }: Props) {
  const [kind, setKind] = useState<AssetKind>('maps')
  const [assets, setAssets] = useState<Asset[]>([])

  useEffect(() => {
    void window.bellavellum.library.list().then(setAssets)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = assets.filter((a) => a.kind === kind)
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ebene hinzufügen">
      <div className="modal-body">
        <h2>Ebene hinzufügen</h2>
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
      </div>
    </div>
  )
}
