import type { Fog } from '../../shared/types'
import { Slider } from './controls'
import { useConfirm } from './Dialog'
import type { FogMode } from './fog'

export type FogShape = 'brush' | 'rect' | 'room'
export type FogTool = { shape: FogShape; mode: FogMode }

/** Shown in the stage toolbar; the reveal/hide mode is a separate toggle there. */
export const FOG_SHAPES: { label: string; icon: string; shape: FogShape }[] = [
  { label: 'Pinsel', icon: 'brush', shape: 'brush' },
  { label: 'Rechteck', icon: 'crop_square', shape: 'rect' },
  { label: 'Raum per Klick', icon: 'meeting_room', shape: 'room' }
]

interface Props {
  fog: Fog | null
  hasLayers: boolean
  /** The brush is the active fog tool, so its size matters. */
  brush: boolean
  brushCells: number
  onBrushCells: (cells: number) => void
  onEnabled: (enabled: boolean) => void
  onReset: (fogged: boolean) => void
}

export function FogPanel({ fog, hasLayers, brush, brushCells, onBrushCells, onEnabled, onReset }: Props) {
  const enabled = fog?.enabled ?? false
  const [confirmDialog, ask] = useConfirm()
  return (
    <div className="section">
      <label className="check">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!hasLayers}
          onChange={(e) => onEnabled(e.target.checked)}
        />
        Fog aktiv
      </label>
      {!hasLayers && <p className="hint">Erst eine Karte hinzufügen.</p>}
      {enabled && (
        <>
          <p className="hint">Werkzeuge und Aufdecken/Verdecken in der Leiste auf der Karte.</p>
          {brush && (
            <Slider
              label="Pinsel"
              value={brushCells * 2}
              min={1}
              max={20}
              unit=""
              display={`${brushCells.toLocaleString('de-DE')} F.`}
              onChange={(v) => onBrushCells(v / 2)}
            />
          )}
          <div className="tool-grid">
            <button onClick={() => onReset(true)}>Alles verdecken</button>
            <button
              onClick={() =>
                ask({
                  title: 'Gesamte Karte aufdecken?',
                  text: 'Ist die Szene live, sehen die Spieler sofort die ganze Karte.',
                  action: 'Alles aufdecken',
                  onConfirm: () => onReset(false)
                })
              }
            >
              Alles aufdecken
            </button>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  )
}
