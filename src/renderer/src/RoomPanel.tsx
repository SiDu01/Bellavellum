import type { Room } from '../../shared/types'
import { Icon, Slider } from './controls'

export type RoomTool = { shape: 'brush' | 'rect' | 'wand'; erase: boolean }

/** Shown in the stage toolbar with the add/remove toggle. */
export const ROOM_SHAPES: { label: string; icon: string; shape: RoomTool['shape'] }[] = [
  { label: 'Pinsel', icon: 'brush', shape: 'brush' },
  { label: 'Rechteck', icon: 'crop_square', shape: 'rect' },
  { label: 'Zauberstab', icon: 'wand_stars', shape: 'wand' }
]

interface Props {
  rooms: Room[]
  /** Room being painted, if any. */
  paintingId: string | null
  tool: RoomTool
  /** Color distance (RGB) the magic wand still counts as floor. */
  tolerance: number
  onTolerance: (tolerance: number) => void
  wandInfo: string | null
  fogActive: boolean
  showRooms: boolean
  onShowRooms: (show: boolean) => void
  onAdd: () => void
  onPaint: (id: string | null) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onFog: (id: string, mode: 'reveal' | 'hide') => void
  hasKey: boolean
  suggesting: boolean
  suggestInfo: string | null
  onSuggest: () => void
}

export function RoomPanel(props: Props) {
  const { rooms, paintingId, tool, tolerance, onTolerance, wandInfo, fogActive, showRooms, onShowRooms, onAdd, onPaint, onRename, onRemove, onFog } = props
  const { hasKey, suggesting, suggestInfo, onSuggest } = props
  return (
    <div className="section">
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
              className="icon-btn"
              aria-label={`${r.name}: Felder bearbeiten`}
              aria-pressed={r.id === paintingId}
              title={r.id === paintingId ? 'Fertig' : 'Felder bearbeiten'}
              onClick={() => onPaint(r.id === paintingId ? null : r.id)}
            >
              <Icon name={r.id === paintingId ? 'check' : 'edit'} />
            </button>
            <button
              className="icon-btn"
              aria-label={`${r.name} löschen`}
              title="Löschen"
              onClick={() => confirm(`Raum „${r.name}“ löschen? Das lässt sich nicht rückgängig machen.`) && onRemove(r.id)}
            >
              <Icon name="delete" />
            </button>
            <div className="room-fog">
              <button className="outlined" disabled={!fogActive || r.squares.length === 0} onClick={() => onFog(r.id, 'reveal')}>
                <Icon name="visibility" />
                Aufdecken
              </button>
              <button className="outlined" disabled={!fogActive || r.squares.length === 0} onClick={() => onFog(r.id, 'hide')}>
                <Icon name="visibility_off" />
                Verdecken
              </button>
            </div>
          </li>
        ))}
      </ol>
      {paintingId && tool.shape === 'wand' && (
        <>
          <Slider label="Toleranz" value={tolerance} min={10} max={150} unit="" onChange={onTolerance} />
          <p className="hint">
            Raum grob umranden. Übernommen werden die Felder im Umriss, die wie der Boden aussehen, samt allem, was sie
            einschließen. Beim Entfernen zählt nur der Umriss.
          </p>
          {wandInfo && <p className="hint">{wandInfo}</p>}
        </>
      )}
      <button onClick={onAdd}>Neuer Raum</button>
      <button
        className="outlined"
        disabled={!hasKey || suggesting}
        title={hasKey ? 'Schickt die sichtbare Map mit Raster an Google Gemini' : 'Erst in den Einstellungen einen Gemini-API-Key speichern'}
        onClick={onSuggest}
      >
        <Icon name="auto_awesome" />
        Räume vorschlagen
      </button>
      {suggestInfo && <p className="hint">{suggestInfo}</p>}
      {!hasKey && <p className="hint">Für Vorschläge einen Gemini-API-Key in den Einstellungen speichern.</p>}
      <p className="hint">
        Alt kehrt Hinzufügen/Entfernen kurz um. Räume folgen immer dem Raster der ganzen Szene, nicht lokalen Rastern.{' '}
        {!fogActive && 'Aufdecken braucht aktiven Fog of War.'}
      </p>
    </div>
  )
}
