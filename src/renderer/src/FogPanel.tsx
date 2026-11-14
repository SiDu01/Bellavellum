import type { Fog } from '../../shared/types'
import { Slider } from './controls'
import type { FogMode } from './fog'

export type FogTool = { shape: 'brush' | 'rect'; mode: FogMode }

const TOOLS: { label: string; tool: FogTool }[] = [
  { label: 'Pinsel aufdecken', tool: { shape: 'brush', mode: 'reveal' } },
  { label: 'Pinsel verdecken', tool: { shape: 'brush', mode: 'hide' } },
  { label: 'Rechteck aufdecken', tool: { shape: 'rect', mode: 'reveal' } },
  { label: 'Rechteck verdecken', tool: { shape: 'rect', mode: 'hide' } }
]

const same = (a: FogTool | null, b: FogTool) => a?.shape === b.shape && a.mode === b.mode

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
    <details className="section" open={enabled || undefined}>
      <summary>Fog of War</summary>
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
            {TOOLS.map(({ label, tool: t }) => (
              <button
                key={label}
                aria-pressed={same(tool, t)}
                className={same(tool, t) ? 'primary' : undefined}
                onClick={() => onTool(same(tool, t) ? null : t)}
              >
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
    </details>
  )
}
