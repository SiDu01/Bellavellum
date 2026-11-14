import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { BLEND_MODES, type Asset, type BlendMode, type Crop, type Layer, type Scene } from '../../shared/types'
import { AssetPicker } from './AssetPicker'
import { fitCamera, layerBounds, sceneBounds, visibleRect, zoomAt, type Camera } from './camera'
import { SceneView } from './SceneView'
import { measure } from './thumbs'
import { useSize } from './useSize'

const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  screen: 'Aufhellen (Screen)',
  multiply: 'Multiplizieren',
  overlay: 'Ineinanderkopieren',
  lighten: 'Nur Hellere',
  darken: 'Nur Dunklere'
}

interface Props {
  initial: Scene
  isLive: boolean
  onSaved: (scene: Scene) => void
  onGoLive: () => void
  onError: (message: string) => void
}

export function SceneEditor({ initial, isLive, onSaved, onGoLive, onError }: Props) {
  const [scene, setScene] = useState(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const [picking, setPicking] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const size = useSize(stage)

  // Debounced save: dragging fires many updates, the stick should not see a write for each.
  const saved = useRef(initial)
  const latest = useRef(scene)
  latest.current = scene
  const flush = useCallback(async () => {
    const current = latest.current
    if (current === saved.current) return
    saved.current = current
    try {
      await window.bellavellum.scenes.save(current)
      onSaved(current)
    } catch (err) {
      onError(`Speichern fehlgeschlagen: ${String(err)}`)
    }
  }, [onSaved, onError])
  useEffect(() => {
    const timer = setTimeout(() => void flush(), 300)
    return () => clearTimeout(timer)
  }, [scene, flush])
  useEffect(() => () => void flush(), [flush])

  const fit = useCallback(() => {
    const bounds = sceneBounds(latest.current.layers)
    if (bounds && size.width > 0) setCamera(fitCamera(bounds, size.width, size.height, 0.9))
  }, [size])
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || size.width === 0) return
    fitted.current = true
    fit()
  }, [size, fit])

  const updateLayer = (id: string, patch: Partial<Layer>) =>
    setScene((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))

  function moveLayer(id: string, delta: number) {
    setScene((s) => {
      const i = s.layers.findIndex((l) => l.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= s.layers.length) return s
      const layers = [...s.layers]
      ;[layers[i], layers[j]] = [layers[j], layers[i]]
      return { ...s, layers }
    })
  }

  function removeLayer(id: string) {
    setScene((s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  async function addLayer(asset: Asset) {
    setPicking(false)
    try {
      const { width, height } = await measure(asset.url, asset.name)
      const layer: Layer = {
        id: crypto.randomUUID(),
        kind: asset.kind,
        name: asset.name,
        width,
        height,
        x: camera.x,
        y: camera.y,
        scale: 1,
        rotation: 0,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        opacity: 1,
        // Effects are often videos on black; screen makes the black transparent.
        blend: asset.kind === 'effects' ? 'screen' : 'normal',
        visible: true
      }
      setScene((s) => ({ ...s, layers: [...s.layers, layer] }))
      setSelectedId(layer.id)
      if (scene.layers.length === 0) setCamera(fitCamera(layerBounds(layer), size.width, size.height, 0.9))
    } catch (err) {
      onError(`${asset.name}: ${String(err)}`)
    }
  }

  // Pointer: drag a layer (the selected one wins if it is under the cursor), otherwise pan.
  const drag = useRef<{ id: string | null; x: number; y: number } | null>(null)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 1) return
    let id: string | null = null
    if (e.button === 0) {
      const ids = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el instanceof HTMLElement ? el.dataset['layerId'] : undefined))
        .filter((v): v is string => v !== undefined)
      id = selectedId && ids.includes(selectedId) ? selectedId : (ids[0] ?? null)
      setSelectedId(id)
    }
    drag.current = { id, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / camera.zoom
    const dy = (e.clientY - d.y) / camera.zoom
    d.x = e.clientX
    d.y = e.clientY
    const id = d.id
    if (id) {
      setScene((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? { ...l, x: l.x + dx, y: l.y + dy } : l)) }))
    } else {
      setCamera((c) => ({ ...c, x: c.x - dx, y: c.y - dy }))
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const factor = Math.pow(1.0015, -e.deltaY)
    setCamera((c) => zoomAt(c, factor, e.clientX - r.left, e.clientY - r.top, r.width, r.height))
  }

  async function goLive() {
    await flush()
    onGoLive()
  }

  const selected = scene.layers.find((l) => l.id === selectedId)

  return (
    <div className="editor">
      <div className="scene-toolbar">
        <input
          aria-label="Szenenname"
          value={scene.name}
          onChange={(e) => setScene((s) => ({ ...s, name: e.target.value }))}
        />
        <button onClick={() => setPicking(true)}>Ebene hinzufügen…</button>
        <button onClick={fit} disabled={scene.layers.length === 0}>
          Einpassen
        </button>
        <span className="spacer" />
        <button onClick={() => setScene((s) => ({ ...s, view: visibleRect(camera, size.width, size.height) }))}>
          Ausschnitt für Spieler
        </button>
        <button onClick={() => setScene((s) => ({ ...s, view: null }))} disabled={!scene.view}>
          Ganze Szene für Spieler
        </button>
        <button className={isLive ? 'live' : 'primary'} onClick={() => void goLive()} disabled={isLive}>
          {isLive ? '● Live' : 'Live schalten'}
        </button>
      </div>

      <div className="editor-body">
        <div
          ref={stage}
          className="stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={onWheel}
        >
          <SceneView scene={scene} camera={camera} selectedId={selectedId} showViewFrame />
          {scene.layers.length === 0 && <p className="stage-hint">Leere Szene. „Ebene hinzufügen…“ wählt eine Karte.</p>}
          <span className="zoom">{Math.round(camera.zoom * 100)} %</span>
        </div>

        <aside className="panel">
          <h2>Ebenen</h2>
          <ol className="layers">
            {[...scene.layers].reverse().map((l) => (
              <li key={l.id} className={l.id === selectedId ? 'selected' : undefined}>
                <input
                  type="checkbox"
                  aria-label={`${l.name} sichtbar`}
                  checked={l.visible}
                  onChange={(e) => updateLayer(l.id, { visible: e.target.checked })}
                />
                <button className="layer-name" title={l.name} onClick={() => setSelectedId(l.id)}>
                  {l.name}
                </button>
                <button aria-label={`${l.name} nach oben`} onClick={() => moveLayer(l.id, 1)}>
                  ↑
                </button>
                <button aria-label={`${l.name} nach unten`} onClick={() => moveLayer(l.id, -1)}>
                  ↓
                </button>
                <button aria-label={`${l.name} entfernen`} onClick={() => removeLayer(l.id)}>
                  ×
                </button>
              </li>
            ))}
          </ol>
          {selected && <LayerProps layer={selected} onChange={(patch) => updateLayer(selected.id, patch)} />}
        </aside>
      </div>

      {picking && <AssetPicker onPick={(a) => void addLayer(a)} onClose={() => setPicking(false)} />}
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, unit, onChange }: SliderProps) {
  return (
    <label className="prop">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {Math.round(value)}
        {unit}
      </output>
    </label>
  )
}

function LayerProps({ layer, onChange }: { layer: Layer; onChange: (patch: Partial<Layer>) => void }) {
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
  const rotate90 = () => onChange({ rotation: ((layer.rotation + 270) % 360) - 180 })

  return (
    <div className="props">
      <h2 title={layer.name}>{layer.name}</h2>
      <Slider label="Größe" value={layer.scale * 100} min={5} max={500} unit=" %" onChange={(v) => onChange({ scale: v / 100 })} />
      <Slider label="Drehung" value={layer.rotation} min={-180} max={180} unit="°" onChange={(v) => onChange({ rotation: v })} />
      <button onClick={rotate90}>90° drehen</button>
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
      <h3>Zuschneiden</h3>
      {crop('top', 'bottom')}
      {crop('bottom', 'top')}
      {crop('left', 'right')}
      {crop('right', 'left')}
    </div>
  )
}
