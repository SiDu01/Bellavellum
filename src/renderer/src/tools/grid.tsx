import { useEffect, useRef, useState, type ReactNode } from 'react'
import { assetUrl, type Grid, type Layer, type LocalGrid, type Scene, type ViewRect } from '../../../shared/types'
import { Icon, NumberField } from '../controls'
import { cropRect, localFrame, sceneFrame, type Frame } from '../frames'
import { calibrate, normalizeRect } from '../grid'
import { detectGrid, detectionToPlane, detectionToScene } from '../gridDetect'
import { GridPanel } from '../GridPanel'
import { isVideo, planePixels } from '../thumbs'
import type { Tool, ToolContext } from './tool'

/** Big maps are analyzed downscaled; 4096 px keeps 1 px grid lines and takes well under a second. */
const DETECT_MAX_SIDE = 4096
/** Preview only; accepting keeps the DM's own grid color and opacity. */
const PROPOSAL_STYLE = { color: '#ff3b30', opacity: 0.9 }

function findLocal(scene: Scene, id: string | null): { layer: Layer; grid: LocalGrid } | null {
  for (const layer of scene.layers) for (const grid of layer.grids) if (grid.id === id) return { layer, grid }
  return null
}

/** Corners of a rectangle in a grid plane, as SVG points in scene coordinates. */
const planeCorners = (f: Frame, r: ViewRect) =>
  [
    [r.x, r.y],
    [r.x + r.width, r.y],
    [r.x + r.width, r.y + r.height],
    [r.x, r.y + r.height]
  ]
    .map(([x = 0, y = 0]) => f.toScene({ x, y }))
    .map((p) => `${p.x},${p.y}`)
    .join(' ')

/** The scene grid and the local grids: calibrate, detect, draw a local grid's region. */
export function useGridTool(ctx: ToolContext): Tool & { toolbar: ReactNode; panel: ReactNode; preview: Scene } {
  const { scene, setScene, zoom } = ctx
  const [calibrating, setCalibrating] = useState(false)
  const [drawingRegion, setDrawingRegion] = useState(false)
  const [cellCount, setCellCount] = useState(1)
  /** Local grid being edited; null = the scene grid. */
  const [gridTarget, setGridTarget] = useState<string | null>(null)
  /** Calibration or region rectangle, in the edited grid's plane. */
  const [marquee, setMarquee] = useState<ViewRect | null>(null)
  /** Detected grid shown as a preview until the DM accepts or rejects it. `target` as in gridTarget. */
  const [proposal, setProposal] = useState<(Pick<Grid, 'size' | 'offsetX' | 'offsetY'> & { target: string | null }) | null>(null)
  const [detectInfo, setDetectInfo] = useState<string | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  // The proposal is in coordinates of the moment it was found: moving the map or editing
  // the grid makes it stale, so drop it instead of accepting it in the wrong place.
  useEffect(() => {
    setProposal(null)
    setDetectInfo(null)
  }, [scene.layers, scene.grid, gridTarget])

  const target = findLocal(scene, gridTarget)
  const editFrame = target ? localFrame(target.layer, target.grid) : sceneFrame(scene.grid)
  const updateGrid = (patch: Partial<Grid>) => setScene((s) => ({ ...s, grid: { ...s.grid, ...patch } }))
  const updateLocalGrid = (id: string, patch: Partial<LocalGrid>) =>
    setScene((s) => ({
      ...s,
      layers: s.layers.map((l) => ({ ...l, grids: l.grids.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
    }))

  const toggleCalibrating = () => {
    const on = !calibrating
    ctx.exclusive()
    setCalibrating(on)
  }
  const toggleRegion = () => {
    const on = !drawingRegion
    ctx.exclusive()
    setDrawingRegion(on)
  }

  function addLocalGrid(l: Layer) {
    const g: LocalGrid = {
      ...scene.grid,
      id: crypto.randomUUID(),
      // Same cell size on screen as the scene grid, as a starting point for calibrating.
      size: scene.grid.size / l.scale,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
      rotation: 0,
      region: cropRect(l)
    }
    ctx.updateLayer(l.id, { grids: [...l.grids, g] })
    setGridTarget(g.id)
  }

  async function detect() {
    const local = target
    const layer = local?.layer ?? scene.layers.find((l) => l.id === ctx.selectedId) ?? scene.layers[0]
    if (!layer) return setDetectInfo('Erst eine Karte hinzufügen.')
    if (isVideo(layer.name)) return setDetectInfo(`${layer.name} ist ein Video, dort wird kein Raster gesucht.`)
    // A local grid is searched in its own turned plane, so any rotation works there.
    if (!local && layer.rotation % 90 !== 0) return setDetectInfo('Nur bei Drehung in 90°-Schritten möglich.')
    setDetectInfo(`Suche Raster in ${layer.name}…`)
    try {
      const url = assetUrl(layer.kind, layer.name)
      // Only the visible part: after a split, the rest of the image belongs to the other parts.
      const visible = cropRect(layer)
      const region = local?.grid.region ?? visible
      const { data, width, height, scale } = await planePixels(url, layer, local?.grid.rotation ?? 0, region, visible, DETECT_MAX_SIDE)
      const found = detectGrid(data, width, height)
      if (!found) {
        setProposal(null)
        setDetectInfo(`Kein gedrucktes Raster in ${layer.name} erkannt. Kalibrieren geht weiterhin von Hand.`)
        return
      }
      // In the plane: the local grid's own, or the layer's px for the scene grid.
      const inPlane = detectionToPlane(found, region, scale)
      const grid = local ? { target: local.grid.id, ...inPlane } : { target: null, ...detectionToScene(inPlane, layer, 1) }
      setProposal(grid)
      setCalibrating(false)
      setDetectInfo(`Vorschlag (rot): ${grid.size.toLocaleString('de-DE', { maximumFractionDigits: 2 })} px pro Feld.`)
    } catch (err) {
      setDetectInfo(`Erkennung fehlgeschlagen: ${String(err)}`)
    }
  }

  function acceptProposal() {
    if (!proposal) return
    const { target: id, ...cells } = proposal
    if (id) updateLocalGrid(id, { ...cells, type: 'square', visible: true })
    else setScene((s) => ({ ...s, grid: { ...s.grid, ...cells, type: 'square', visible: true } }))
    setProposal(null)
    setDetectInfo(null)
  }

  const preview = (() => {
    if (!proposal) return scene
    const { target: id, ...cells } = proposal
    const shown = { ...cells, type: 'square' as const, visible: true, ...PROPOSAL_STYLE }
    return id
      ? { ...scene, layers: scene.layers.map((l) => ({ ...l, grids: l.grids.map((g) => (g.id === id ? { ...g, ...shown } : g)) })) }
      : { ...scene, grid: { ...scene.grid, ...shown } }
  })()

  const outline = (r: ViewRect, dashed: boolean) => (
    <svg className="lasso">
      <polygon
        points={planeCorners(editFrame, r)}
        fill={dashed ? 'none' : 'rgb(233 193 108 / 0.15)'}
        stroke="var(--primary)"
        strokeWidth={2 / zoom}
        strokeDasharray={dashed ? `${8 / zoom} ${6 / zoom}` : undefined}
      />
    </svg>
  )

  const tool: Tool = {
    active: calibrating || drawingRegion,
    down(_e, p) {
      if (!calibrating && !drawingRegion) return false
      const q = editFrame.fromScene(p)
      start.current = q
      setMarquee({ x: q.x, y: q.y, width: 0, height: 0 })
      return true
    },
    move(_e, p) {
      const s = start.current
      if (!s) return
      const q = editFrame.fromScene(p)
      setMarquee(normalizeRect(s.x, s.y, q.x, q.y))
    },
    // The rectangle comes from the release point: the marquee state may not include the last move yet.
    up(_e, p) {
      const s = start.current
      start.current = null
      if (!s) return
      const q = editFrame.fromScene(p)
      const rect = normalizeRect(s.x, s.y, q.x, q.y)
      if (rect.width > 2 && rect.height > 2) {
        if (drawingRegion) {
          if (target) updateLocalGrid(target.grid.id, { region: rect })
        } else if (target) {
          const { size, offsetX, offsetY } = calibrate(target.grid, rect, cellCount)
          updateLocalGrid(target.grid.id, { size, offsetX, offsetY, visible: true })
        } else {
          setScene((sc) => ({ ...sc, grid: { ...calibrate(sc.grid, rect, cellCount), visible: true } }))
        }
      }
      setMarquee(null)
      setCalibrating(false)
      setDrawingRegion(false)
    },
    cancel() {
      start.current = null
      setMarquee(null)
    },
    reset() {
      setCalibrating(false)
      setDrawingRegion(false)
    },
    overlay: (
      <>
        {ctx.tab === 'grid' && target && outline(target.grid.region, true)}
        {marquee && outline(marquee, false)}
      </>
    )
  }

  const toolbar = (
    <>
      {target && (
        <button aria-label="Bereich ziehen" title="Bereich des lokalen Rasters ziehen" aria-pressed={drawingRegion} onClick={toggleRegion}>
          <Icon name="highlight_alt" />
        </button>
      )}
      <button
        aria-label="Raster erkennen"
        title={target ? 'Raster im Bereich des lokalen Rasters erkennen' : 'Raster erkennen'}
        disabled={scene.layers.length === 0}
        onClick={() => void detect()}
      >
        <Icon name="auto_awesome" />
      </button>
      <button aria-label="Kalibrieren" title="Kalibrieren: Rechteck über Rasterfelder ziehen" aria-pressed={calibrating} onClick={toggleCalibrating}>
        <Icon name="straighten" />
      </button>
    </>
  )

  const panel = (
    <>
      <div className="section">
        <label className="prop">
          <span>Raster</span>
          <select
            value={target ? target.grid.id : ''}
            onChange={(e) => {
              setGridTarget(e.target.value || null)
              setCalibrating(false)
              setDrawingRegion(false)
            }}
          >
            <option value="">Ganze Szene</option>
            {scene.layers.flatMap((l) =>
              l.grids.map((g, i) => (
                <option key={g.id} value={g.id}>
                  {l.name} · lokal {i + 1}
                </option>
              ))
            )}
          </select>
        </label>
        <button disabled={!ctx.selectedLayer} onClick={() => ctx.selectedLayer && addLocalGrid(ctx.selectedLayer)}>
          <Icon name="add" />
          Lokales Raster auf ausgewählter Ebene
        </button>
        {target && (
          <>
            <p className="hint">
              Gehört zu {target.layer.name} und wandert mit ihr. Erst die Drehung an das gedruckte Raster anpassen, dann den
              Bereich ziehen und kalibrieren.
            </p>
            <NumberField
              label="Drehung (°)"
              value={target.grid.rotation}
              step={0.5}
              onChange={(rotation) => updateLocalGrid(target.grid.id, { rotation })}
            />
            <div className="tool-grid">
              <button className={drawingRegion ? 'primary' : undefined} aria-pressed={drawingRegion} onClick={toggleRegion}>
                Bereich ziehen
              </button>
              <button
                onClick={() => {
                  ctx.updateLayer(target.layer.id, { grids: target.layer.grids.filter((g) => g.id !== target.grid.id) })
                  setGridTarget(null)
                }}
              >
                Entfernen
              </button>
            </div>
          </>
        )}
      </div>
      <GridPanel
        grid={target ? target.grid : scene.grid}
        onChange={target ? (patch) => updateLocalGrid(target.grid.id, patch) : updateGrid}
        calibrating={calibrating}
        onCalibrate={toggleCalibrating}
        cellCount={cellCount}
        onCellCount={setCellCount}
        detectInfo={detectInfo}
        hasProposal={proposal !== null}
        onDetect={() => void detect()}
        onAcceptProposal={acceptProposal}
        onRejectProposal={() => {
          setProposal(null)
          setDetectInfo(null)
        }}
      />
    </>
  )

  return { ...tool, toolbar, panel, preview }
}
