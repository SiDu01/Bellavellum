import { useEffect } from 'react'
import type { DisplayInfo } from '../../shared/types'

interface Props {
  displays: DisplayInfo[]
  onClose: () => void
}

export function DisplayPicker({ displays, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function pick(id: number) {
    try {
      await window.bellavellum.openPlayer(id)
      onClose()
    } catch (err) {
      alert(String(err))
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Spielerbildschirm wählen">
      <div className="modal-body">
        <h2>Spielerbildschirm wählen</h2>
        <ul className="displays">
          {displays.map((d) => (
            <li key={d.id}>
              <button className={d.player ? 'primary' : undefined} onClick={() => void pick(d.id)}>
                <strong>{d.label}</strong>
                <span>
                  {d.width} × {d.height}
                  {d.primary && ' · dein Bildschirm (als Fenster)'}
                  {d.player && ' · aktuell'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

