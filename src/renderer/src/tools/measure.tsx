import { useRef, useState, type ReactNode } from 'react'
import type { Area, AreaShape } from '../../../shared/types'
import { Icon } from '../controls'
import { layerAt, toLayer } from '../frames'
import { AreaView } from '../SceneView'
import type { Tool, ToolContext } from './tool'

const AREA_TOOLS: { shape: AreaShape; label: string; icon: string }[] = [
  { shape: 'ruler', label: 'Lineal', icon: 'square_foot' },
  { shape: 'burst', label: 'Explosion', icon: 'flare' },
  { shape: 'cone', label: 'Kegel', icon: 'change_history' },
  { shape: 'line', label: 'Linie', icon: 'horizontal_rule' }
]
export const AREA_LABELS = Object.fromEntries(AREA_TOOLS.map((t) => [t.shape, t.label])) as Record<AreaShape, string>

type Measuring = { layerId: string | null; area: Area }

/** PF2e ruler and areas: measured while dragging, optionally placed on the layer below. */
export function useMeasureTool(ctx: ToolContext): Tool & { toolbar: ReactNode; info: string | null } {
  const { scene } = ctx
  const [shape, setShape] = useState<AreaShape | null>(null)
  const [place, setPlace] = useState(false)
  const [showPlayers, setShowPlayers] = useState(true)
  const [newVisible, setNewVisible] = useState(true)
  const [measuring, setMeasuring] = useState<Measuring | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const drag = useRef<Measuring | null>(null)

  function show(m: Measuring | null) {
    setMeasuring(m)
    if (showPlayers) ctx.send({ type: 'measure', layerId: m?.layerId ?? null, area: m?.area ?? null })
  }

  const tool: Tool = {
    active: shape !== null,
    down(e, p) {
      if (!shape) return false
      const layer = layerAt(scene, p)
      // A burst on a token surrounds its whole space (PF2e emanation); Alt ignores the token.
      const hit = shape === 'burst' && !e.altKey ? ctx.hitTest(e.clientX, e.clientY) : null
      const token = hit?.token ? scene.tokens.find((t) => t.id === hit.id) : undefined
      const o = token ?? p
      const at = layer ? toLayer(layer, o) : o
      const area: Area = {
        id: crypto.randomUUID(),
        shape,
        x: at.x,
        y: at.y,
        tx: at.x,
        ty: at.y,
        // Whole cells only: a 1.5-cell space would cut cells in half.
        size: Math.max(1, Math.round(token?.cells ?? 1)),
        visible: newVisible
      }
      drag.current = { layerId: layer?.id ?? null, area }
      show(drag.current)
      return true
    },
    move(_e, p) {
      const d = drag.current
      if (!d) return
      const layer = scene.layers.find((l) => l.id === d.layerId)
      const t = layer ? toLayer(layer, p) : p
      d.area = { ...d.area, tx: t.x, ty: t.y }
      show({ ...d })
    },
    up() {
      const d = drag.current
      drag.current = null
      if (!d) return
      if (place) {
        const layer = scene.layers.find((l) => l.id === d.layerId)
        if (layer) ctx.updateLayer(layer.id, { areas: [...layer.areas, d.area] })
        setInfo(layer ? null : 'Flächen hängen an einer Karte: dort beginnen, wo eine Ebene liegt.')
      }
      show(null)
    },
    cancel() {
      if (drag.current) show(null)
      drag.current = null
    },
    reset: () => setShape(null),
    overlay: measuring && (
      <AreaView
        scene={scene}
        layer={scene.layers.find((l) => l.id === measuring.layerId) ?? null}
        area={measuring.area}
        zoom={ctx.zoom}
      />
    )
  }

  const toolbar = (
    <div className="floating-tools side-tools" role="toolbar" aria-label="Messen" onPointerDown={(e) => e.stopPropagation()}>
      {AREA_TOOLS.map(({ label, icon, shape: s }) => (
        <button
          key={s}
          aria-label={label}
          title={
            s === 'burst'
              ? `${label}: ziehen ab Rasterkreuzung oder Feldmitte. Auf einem Token: um seinen ganzen Platz (Alt ignoriert das Token)`
              : `${label}: auf der Karte ziehen, ab Rasterkreuzung oder Feldmitte`
          }
          aria-pressed={shape === s}
          onClick={() => {
            ctx.exclusive()
            setShape(shape === s ? null : s)
          }}
        >
          <Icon name={icon} />
        </button>
      ))}
      <span className="divider" />
      <button aria-label="Nur messen" title="Nur messen: verschwindet beim Loslassen" aria-pressed={!place} onClick={() => setPlace(false)}>
        <Icon name="straighten" />
      </button>
      <button aria-label="Platzieren" title="Platzieren: bleibt als Unterebene der Karte darunter" aria-pressed={place} onClick={() => setPlace(true)}>
        <Icon name="push_pin" />
      </button>
      <span className="divider" />
      <button
        aria-label="Spieler sehen das Messen"
        title={showPlayers ? 'Spieler sehen das Messen' : 'Spieler sehen das Messen nicht'}
        aria-pressed={showPlayers}
        onClick={() => setShowPlayers(!showPlayers)}
      >
        <Icon name={showPlayers ? 'cast_connected' : 'cast'} />
      </button>
      <button
        aria-label="Neue Flächen für Spieler sichtbar"
        title={newVisible ? 'Neue Flächen sind für Spieler sichtbar' : 'Neue Flächen sind nur für dich sichtbar'}
        aria-pressed={newVisible}
        onClick={() => setNewVisible(!newVisible)}
      >
        <Icon name={newVisible ? 'visibility' : 'visibility_off'} />
      </button>
    </div>
  )

  return { ...tool, toolbar, info }
}
