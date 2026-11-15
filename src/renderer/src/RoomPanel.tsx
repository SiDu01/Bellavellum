import type { Room } from '../../shared/types'
import { Slider } from './controls'

export type RoomTool = { shape: 'brush' | 'rect' | 'wand'; erase: boolean }

const SHAPE_LABELS: Record<RoomTool['shape'], string> = { brush: 'Pinsel', rect: 'Rechteck', wand: 'Zauberstab' }

interface Props {
  rooms: Room[]
  /** Room being painted, if any. */
  paintingId: string | null
  tool: RoomTool
  onTool: (tool: RoomTool) => void
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
}

export function RoomPanel(props: Props) {
  const { rooms, paintingId, tool, onTool, tolerance, onTolerance, wandInfo, fogActive, showRooms, onShowRooms, onAdd, onPaint, onRename, onRemove, onFog } = props
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
              title="Felder bearbeiten"
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
      {paintingId && (
        <div className="tool-grid">
          {(['brush', 'rect', 'wand'] as const).map((shape) => (
            <button
              key={shape}
              aria-pressed={tool.shape === shape}
              className={tool.shape === shape ? 'primary' : undefined}
              onClick={() => onTool({ ...tool, shape })}
            >
              {SHAPE_LABELS[shape]}
            </button>
          ))}
          {[false, true].map((erase) => (
            <button
              key={String(erase)}
              aria-pressed={tool.erase === erase}
              className={tool.erase === erase ? 'primary' : undefined}
              onClick={() => onTool({ ...tool, erase })}
            >
              {erase ? 'Felder entfernen' : 'Felder hinzufügen'}
            </button>
          ))}
        </div>
      )}
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
      <p className="hint">
        Alt kehrt Hinzufügen/Entfernen kurz um. {!fogActive && 'Aufdecken braucht aktiven Fog of War.'}
      </p>
    </details>
  )
}
