import { useState } from 'react'
import type { DisplayInfo } from '../../shared/types'
import { Modal } from './Dialog'

interface Props {
  displays: DisplayInfo[]
  onClose: () => void
}

export function DisplayPicker({ displays, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)

  async function pick(id: number) {
    try {
      await window.bellavellum.openPlayer(id)
      onClose()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <Modal label="Spielerbildschirm wählen" onClose={onClose}>
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
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  )
}
