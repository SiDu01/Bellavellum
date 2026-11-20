import { useState } from 'react'
import { BLEND_MODES, type BlendMode, type Crop, type Layer, type Token } from '../../shared/types'
import { baseOf } from '../../shared/assetPaths'
import { Icon, NumberField, Slider } from './controls'
import { isVideo } from './thumbs'
import { isAnimated, VIDEO_SPLIT_HINT } from './tools/layerEdit'

const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  screen: 'Aufhellen (Screen)',
  multiply: 'Multiplizieren',
  overlay: 'Ineinanderkopieren',
  lighten: 'Nur Hellere',
  darken: 'Nur Dunklere'
}

export const rotated90 = (rotation: number) => ((rotation + 270) % 360) - 180

interface LayerPropsProps {
  layer: Layer
  onChange: (patch: Partial<Layer>) => void
  onSplit: (cols: number, rows: number) => void
  onSaveImage: () => void
  /** Status of the last image save. */
  info: string | null
}

export function LayerProps({ layer, onChange, onSplit, onSaveImage, info }: LayerPropsProps) {
  const [cols, setCols] = useState(2)
  const [rows, setRows] = useState(1)
  const crop = (side: keyof Crop, opposite: keyof Crop) => (
    <Slider
      label={{ top: 'Oben', right: 'Rechts', bottom: 'Unten', left: 'Links' }[side]}
      value={layer.crop[side] * 100}
      min={0}
      max={95 - layer.crop[opposite] * 100}
      unit=" %"
      onChange={(v) => onChange({ crop: { ...layer.crop, [side]: v / 100 } })}
    />
  )
  const rotate90 = () => onChange({ rotation: rotated90(layer.rotation) })

  return (
    <div className="props">
      <h2 title={layer.name}>{baseOf(layer.name)}</h2>
      {layer.locked && <p className="hint">Gesperrt. Entsperren (Schloss in der Liste), um Lage und Zuschnitt zu ändern.</p>}
      <fieldset className="plain" disabled={layer.locked}>
        <Slider label="Größe" value={layer.scale * 100} min={5} max={500} unit=" %" onChange={(v) => onChange({ scale: v / 100 })} />
        <Slider label="Drehung" value={layer.rotation} min={-180} max={180} unit="°" onChange={(v) => onChange({ rotation: v })} />
        <button onClick={rotate90}>
          <Icon name="rotate_90_degrees_cw" />
          90° drehen
        </button>
      </fieldset>
      <Slider
        label="Deckkraft"
        value={layer.opacity * 100}
        min={0}
        max={100}
        unit=" %"
        onChange={(v) => onChange({ opacity: v / 100 })}
      />
      <label className="prop">
        <span>Mischmodus</span>
        <select value={layer.blend} onChange={(e) => onChange({ blend: e.target.value as BlendMode })}>
          {BLEND_MODES.map((m) => (
            <option key={m} value={m}>
              {BLEND_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="plain" disabled={layer.locked}>
        <h3>Zuschneiden</h3>
        {crop('top', 'bottom')}
        {crop('bottom', 'top')}
        {crop('left', 'right')}
        {crop('right', 'left')}
        <p className="hint">Oder mit dem Zuschneiden-Werkzeug ein Rechteck über die Ebene ziehen.</p>
      </fieldset>
      <h3>Aufteilen</h3>
      <p className="hint">Macht aus dem sichtbaren Teil einzelne Ebenen, die sich getrennt verschieben lassen. Das Original bleibt unverändert.</p>
      <NumberField label="Spalten" value={cols} min={1} step={1} onChange={(v) => setCols(Math.max(1, Math.round(v)))} />
      <NumberField label="Zeilen" value={rows} min={1} step={1} onChange={(v) => setRows(Math.max(1, Math.round(v)))} />
      <button
        disabled={cols * rows < 2 || isVideo(layer.name)}
        title={isVideo(layer.name) ? VIDEO_SPLIT_HINT : undefined}
        onClick={() => onSplit(cols, rows)}
      >
        <Icon name="grid_view" />
        In {cols * rows} Teile aufteilen
      </button>
      <h3>Als Bild speichern</h3>
      <button
        disabled={isAnimated(layer.name)}
        title={isAnimated(layer.name) ? 'Nur für Standbilder: Videos und GIFs würden ihre Animation verlieren' : undefined}
        onClick={onSaveImage}
      >
        <Icon name="save" />
        Zuschnitt in die Bibliothek
      </button>
      {info && (
        <p className="hint" role="status">
          {info}
        </p>
      )}
    </div>
  )
}

interface TokenPropsProps {
  token: Token
  onChange: (patch: Partial<Token>) => void
  onSnap: () => void
}

export function TokenProps({ token, onChange, onSnap }: TokenPropsProps) {
  return (
    <div className="props">
      <h2 title={token.name}>{token.label || baseOf(token.name)}</h2>
      <label className="prop">
        <span>Bezeichnung</span>
        <input value={token.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <NumberField label="Felder" value={token.cells} min={0.25} step={0.5} onChange={(cells) => onChange({ cells })} />
      <button onClick={onSnap}>Am Raster ausrichten</button>
    </div>
  )
}
