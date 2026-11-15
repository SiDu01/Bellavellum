import type { Fog } from '../../shared/types'
import { Icon, Slider } from './controls'
import type { FogMode } from './fog'

export type FogTool = { shape: 'brush' | 'rect' | 'room'; mode: FogMode }

export const FOG_TOOLS: { label: string; icon: string; tool: FogTool }[] = [
  { label: 'Pinsel aufdecken', icon: 'brush', tool: { shape: 'brush', mode: 'reveal' } },
  { label: 'Pinsel verdecken', icon: 'format_paint', tool: { shape: 'brush', mode: 'hide' } },
  { label: 'Rechteck aufdecken', icon: 'crop_square', tool: { shape: 'rect', mode: 'reveal' } },
  { label: 'Rechteck verdecken', icon: 'select', tool: { shape: 'rect', mode: 'hide' } },
  { label: 'Raum per Klick aufdecken', icon: 'meeting_room', tool: { shape: 'room', mode: 'reveal' } }
]

export const same = (a: FogTool | null, b: FogTool) => a?.shape === b.shape && a.mode === b.mode

interface Props {
  fog: Fog | null
  hasLayers: boolean
  tool: FogTool | null
  onTool: (tool: FogTool | null) => void
  brushCells: number
  onBrushCells: (cells: number) => void
  onEnabled: (enabled: boolean) => void
  onReset: (fogged: boolean) => void
}

export function FogPanel({ fog, hasLayers, tool, onTool, brushCells, onBrushCells, onEnabled, onReset }: Props) {
  const enabled = fog?.enabled ?? false
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
          <div className="tool-grid">
            {FOG_TOOLS.map(({ label, icon, tool: t }) => (
              <button
                key={label}
                aria-pressed={same(tool, t)}
                className={same(tool, t) ? 'primary' : undefined}
                onClick={() => onTool(same(tool, t) ? null : t)}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
          <Slider
            label="Pinsel"
            value={brushCells * 2}
            min={1}
            max={20}
            unit=""
            display={`${brushCells.toLocaleString('de-DE')} F.`}
            onChange={(v) => onBrushCells(v / 2)}
          />
          <p className="hint">Pinselgröße in Rasterfeldern. Mittlere Maustaste verschiebt die Ansicht.</p>
          <div className="tool-grid">
            <button onClick={() => onReset(true)}>Alles verdecken</button>
            <button onClick={() => onReset(false)}>Alles aufdecken</button>
          </div>
          <p className="hint">Beide passen den Fog-Bereich an die aktuelle Szene an.</p>
        </>
      )}
    </div>
  )
}
