import type { Room } from '../../shared/types'

interface Props {
  rooms: Room[]
  /** Room being painted, if any. */
  paintingId: string | null
  fogActive: boolean
  showRooms: boolean
  onShowRooms: (show: boolean) => void
  onAdd: () => void
  onPaint: (id: string | null) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onFog: (id: string, mode: 'reveal' | 'hide') => void
}

export function RoomPanel(props: Props) {
  const { rooms, paintingId, fogActive, showRooms, onShowRooms, onAdd, onPaint, onRename, onRemove, onFog } = props
  return (
    <details className="section" open={rooms.length > 0 || undefined}>
      <summary>Räume</summary>
      <label className="check">
        <input type="checkbox" checked={showRooms} onChange={(e) => onShowRooms(e.target.checked)} />
        Räume anzeigen (nur für dich)
      </label>
      <ol className="layers">
        {rooms.map((r) => (
          <li key={r.id} className={r.id === paintingId ? 'selected' : undefined}>
            <span className="swatch" style={{ background: r.color }} aria-hidden="true" />
            <input
              className="room-name"
              aria-label="Raumname"
              value={r.name}
              onChange={(e) => onRename(r.id, e.target.value)}
            />
            <button
              aria-pressed={r.id === paintingId}
              title="Felder malen, Alt radiert"
              onClick={() => onPaint(r.id === paintingId ? null : r.id)}
            >
              {r.id === paintingId ? 'Fertig' : 'Malen'}
            </button>
            <button
              aria-label={`${r.name} löschen`}
              onClick={() => confirm(`Raum „${r.name}“ löschen? Das lässt sich nicht rückgängig machen.`) && onRemove(r.id)}
            >
              ×
            </button>
            <div className="room-fog">
              <button disabled={!fogActive || r.squares.length === 0} onClick={() => onFog(r.id, 'reveal')}>
                Aufdecken
              </button>
              <button disabled={!fogActive || r.squares.length === 0} onClick={() => onFog(r.id, 'hide')}>
                Verdecken
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button onClick={onAdd}>Neuer Raum</button>
      <p className="hint">
        Malen: Felder mit der Maus anmalen, mit Alt radieren. {!fogActive && 'Aufdecken braucht aktiven Fog of War.'}
      </p>
    </details>
  )
}
