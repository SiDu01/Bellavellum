import { GRID_TYPES, type Grid, type GridType } from '../../shared/types'
import { Fold, Icon, NumberField, Slider } from './controls'

const TYPE_LABELS: Record<GridType, string> = {
  square: 'Quadrate',
  'hex-pointy': 'Hex (Spitze oben)',
  'hex-flat': 'Hex (flach oben)'
}

interface Props {
  grid: Grid
  onChange: (patch: Partial<Grid>) => void
  calibrating: boolean
  onCalibrate: () => void
  cellCount: number
  onCellCount: (count: number) => void
  /** Status of the last detection, shown under the button. */
  detectInfo: string | null
  hasProposal: boolean
  onDetect: () => void
  onAcceptProposal: () => void
  onRejectProposal: () => void
}

export function GridPanel({
  grid,
  onChange,
  calibrating,
  onCalibrate,
  cellCount,
  onCellCount,
  detectInfo,
  hasProposal,
  onDetect,
  onAcceptProposal,
  onRejectProposal
}: Props) {
  return (
    <div className="section">
      {/* The two ways to set the grid up come first: they are why most people open this tab. */}
      <div className="tool-grid">
        {hasProposal ? (
          <>
            <button className="primary" onClick={onAcceptProposal}>
              Übernehmen
            </button>
            <button onClick={onRejectProposal}>Verwerfen</button>
          </>
        ) : (
          <>
            <button onClick={onDetect} title="Sucht ein gedrucktes Quadrat-Raster in der ausgewählten Karte (sonst der untersten)">
              <Icon name="wand_shine" />
              Erkennen
            </button>
            <button className={calibrating ? 'primary' : undefined} onClick={onCalibrate} aria-pressed={calibrating}>
              <Icon name="straighten" />
              Kalibrieren
            </button>
          </>
        )}
      </div>
      {detectInfo && (
        <p className="hint" role="status">
          {detectInfo}
        </p>
      )}
      {calibrating && (
        <>
          <p className="hint">
            {grid.type === 'square'
              ? 'Rechteck über die gedruckten Felder der Karte ziehen.'
              : 'Rechteck über Hex-Felder in einer Reihe ziehen, von flacher Seite zu flacher Seite.'}{' '}
            Mehr Felder = genauer.
          </p>
          <NumberField label="Felder" value={cellCount} min={1} step={1} onChange={(v) => onCellCount(Math.round(v))} />
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={grid.visible} onChange={(e) => onChange({ visible: e.target.checked })} />
        Raster anzeigen
      </label>
      <label className="check">
        <input type="checkbox" checked={grid.snap} onChange={(e) => onChange({ snap: e.target.checked })} />
        Tokens einrasten (Alt hält frei)
      </label>
      <label className="prop">
        <span>Form</span>
        <select value={grid.type} onChange={(e) => onChange({ type: e.target.value as GridType })}>
          {GRID_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {grid.visible && (
        <>
          <label className="prop">
            <span>Farbe</span>
            <input type="color" value={grid.color} onChange={(e) => onChange({ color: e.target.value })} />
          </label>
          <Slider
            label="Deckkraft"
            value={grid.opacity * 100}
            min={5}
            max={100}
            unit=" %"
            onChange={(v) => onChange({ opacity: v / 100 })}
          />
        </>
      )}
      <Fold id="grid-fine" title="Feinjustierung">
        <NumberField label="Feldgröße" value={grid.size} min={5} step={0.5} onChange={(size) => onChange({ size })} />
        <NumberField label="Versatz X" value={grid.offsetX} step={0.5} onChange={(offsetX) => onChange({ offsetX })} />
        <NumberField label="Versatz Y" value={grid.offsetY} step={0.5} onChange={(offsetY) => onChange({ offsetY })} />
      </Fold>
    </div>
  )
}
