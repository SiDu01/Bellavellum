import { useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Fog, ViewRect } from '../../../shared/types'
import { sceneBounds } from '../camera'
import { Icon, ModeToggle } from '../controls'
import { canvasToPng, maskScale, paintLine, paintRect, solidMask, toMask, type FogMode } from '../fog'
import { FOG_SHAPES, FogPanel, type FogShape, type FogTool } from '../FogPanel'
import { normalizeRect } from '../grid'
import { roomAt } from '../rooms'
import type { Tool, ToolContext } from './tool'

export interface FogControl {
  /** The fog while it is switched on. */
  fog: Fog | null
  /** Reveals or hides a room's squares and saves the mask. */
  fogRoom: (id: string, mode: FogMode) => void
  /** For SceneView: the DM sees through the fog and paints on this canvas. */
  view: { version: number; dm: true; canvasRef: RefObject<HTMLCanvasElement | null> }
}

/** Fog of war: brush, rectangle and room reveal on the mask canvas, saved as PNG after each stroke. */
export function useFogTool(ctx: ToolContext): Tool & FogControl & { toolbar: ReactNode; panel: ReactNode } {
  const { scene, setScene } = ctx
  const [shape, setShape] = useState<FogShape | null>(null)
  const [mode, setMode] = useState<FogMode>('reveal')
  const [brushCells, setBrushCells] = useState(2)
  const [marquee, setMarquee] = useState<ViewRect | null>(null)
  // The DM canvas is the source of truth while editing; this only changes to reload it from disk.
  const [version, setVersion] = useState(() => Date.now())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** Rectangle start in scene coordinates, or the last brush point in mask pixels. */
  const drag = useRef<{ rect: boolean; x: number; y: number } | null>(null)

  const active = scene.fog?.enabled ? scene.fog : null
  const tool: FogTool | null = active && shape ? { shape, mode } : null

  // Painting before the saved mask has loaded would save "all fogged + stroke" over it.
  const readyCanvas = () => (canvasRef.current?.dataset['ready'] ? canvasRef.current : null)
  const fogCtx = () => readyCanvas()?.getContext('2d') ?? null
  const brushWidth = (rect: ViewRect) => brushCells * scene.grid.size * maskScale(rect)

  async function saveCanvas() {
    const canvas = readyCanvas()
    if (!canvas) return
    try {
      await window.bellavellum.scenes.saveFog(scene.id, await canvasToPng(canvas))
      setScene((s) => (s.fog ? { ...s, fog: { ...s.fog, revision: s.fog.revision + 1 } } : s))
    } catch (err) {
      ctx.onError(`Fog speichern fehlgeschlagen: ${String(err)}`)
    }
  }

  /** Fits the fog area to the current scene and fills it completely. */
  async function resetFog(fogged: boolean) {
    const rect = sceneBounds(scene.layers)
    if (!rect) return
    try {
      await window.bellavellum.scenes.saveFog(scene.id, await solidMask(rect, fogged))
      setScene((s) => ({ ...s, fog: { enabled: true, rect, revision: (s.fog?.revision ?? 0) + 1 } }))
      setVersion(Date.now())
    } catch (err) {
      ctx.onError(`Fog speichern fehlgeschlagen: ${String(err)}`)
    }
  }

  function setEnabled(enabled: boolean) {
    if (enabled && !scene.fog) void resetFog(true)
    else setScene((s) => (s.fog ? { ...s, fog: { ...s.fog, enabled } } : s))
    if (!enabled) setShape(null)
  }

  function fogRoom(id: string, m: FogMode) {
    const c = fogCtx()
    const room = scene.rooms.find((r) => r.id === id)
    if (!c || !active || !room) return
    for (const [x, y, s] of room.squares) {
      const a = toMask(active.rect, x, y)
      const b = toMask(active.rect, x + s, y + s)
      paintRect(c, m, normalizeRect(a.x, a.y, b.x, b.y))
    }
    void saveCanvas()
  }

  const fogTool: Tool = {
    active: tool !== null,
    down(_e, p) {
      if (!tool || !active) return false
      if (tool.shape === 'rect') {
        drag.current = { rect: true, x: p.x, y: p.y }
        setMarquee({ x: p.x, y: p.y, width: 0, height: 0 })
      } else if (tool.shape === 'room') {
        const room = roomAt(scene.rooms, p.x, p.y)
        if (room) fogRoom(room.id, tool.mode)
      } else {
        const at = toMask(active.rect, p.x, p.y)
        const c = fogCtx()
        if (c) paintLine(c, tool.mode, at, at, brushWidth(active.rect))
        drag.current = { rect: false, ...at }
      }
      return true
    },
    move(_e, p) {
      const d = drag.current
      if (!d) return
      if (d.rect) return setMarquee(normalizeRect(d.x, d.y, p.x, p.y))
      const c = fogCtx()
      if (!c || !active || !tool) return
      const at = toMask(active.rect, p.x, p.y)
      paintLine(c, tool.mode, d, at, brushWidth(active.rect))
      d.x = at.x
      d.y = at.y
    },
    // The rectangle comes from the release point: the marquee state may not include the last move yet.
    up(_e, p) {
      const d = drag.current
      drag.current = null
      if (!d) return
      if (d.rect) {
        const c = fogCtx()
        if (c && active && tool) {
          const a = toMask(active.rect, d.x, d.y)
          const b = toMask(active.rect, p.x, p.y)
          paintRect(c, tool.mode, normalizeRect(a.x, a.y, b.x, b.y))
          void saveCanvas()
        }
        setMarquee(null)
      } else {
        void saveCanvas()
      }
    },
    cancel() {
      drag.current = null
      setMarquee(null)
    },
    reset: () => setShape(null),
    overlay: marquee && (
      <div
        className="marquee"
        style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height, borderWidth: 2 / ctx.zoom }}
      />
    )
  }

  const toolbar = (
    <>
      {FOG_SHAPES.map(({ label, icon, shape: s }) => (
        <button
          key={s}
          aria-label={label}
          title={active ? label : 'Erst Fog aktivieren'}
          aria-pressed={tool?.shape === s}
          disabled={!active}
          onClick={() => {
            ctx.exclusive()
            setShape(tool?.shape === s ? null : s)
          }}
        >
          <Icon name={icon} />
        </button>
      ))}
      <span className="divider" />
      <ModeToggle
        disabled={!active}
        items={[
          { label: 'Aufdecken', icon: 'visibility', on: mode === 'reveal', pick: () => setMode('reveal') },
          { label: 'Verdecken', icon: 'visibility_off', on: mode === 'hide', pick: () => setMode('hide') }
        ]}
      />
    </>
  )

  const panel = (
    <FogPanel
      fog={scene.fog}
      hasLayers={scene.layers.length > 0}
      brush={tool?.shape === 'brush'}
      brushCells={brushCells}
      onBrushCells={setBrushCells}
      onEnabled={setEnabled}
      onReset={(fogged) => void resetFog(fogged)}
    />
  )

  return { ...fogTool, fog: active, fogRoom, view: { version, dm: true, canvasRef }, toolbar, panel }
}
