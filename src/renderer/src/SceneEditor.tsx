import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import {
  assetUrl,
  BLEND_MODES,
  type Asset,
  type BlendMode,
  type Crop,
  type Grid,
  type Layer,
  type Room,
  type Scene,
  type Token,
  type ViewRect
} from '../../shared/types'
import { AssetPicker } from './AssetPicker'
import { fitCamera, layerBounds, sceneBounds, screenToWorld, visibleRect, zoomAt, type Camera } from './camera'
import { NumberField, Slider } from './controls'
import { canvasToPng, maskScale, paintLine, paintRect, solidMask, toMask, type FogMode } from './fog'
import { FogPanel, type FogTool } from './FogPanel'
import { calibrate, normalizeRect, snap } from './grid'
import { detectGrid, detectionToScene } from './gridDetect'
import { GridPanel } from './GridPanel'
import { RoomPanel } from './RoomPanel'
import { addSquare, cellAt, eraseAt, ROOM_COLORS, roomAt } from './rooms'
import { SceneView } from './SceneView'
import { imagePixels, isVideo, measure } from './thumbs'
import { useSize } from './useSize'

const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  screen: 'Aufhellen (Screen)',
  multiply: 'Multiplizieren',
  overlay: 'Ineinanderkopieren',
  lighten: 'Nur Hellere',
  darken: 'Nur Dunklere'
}

/** Big maps are analyzed downscaled; 4096 px keeps 1 px grid lines and takes well under a second. */
const DETECT_MAX_SIDE = 4096
/** Preview only; accepting keeps the DM's own grid color and opacity. */
const PROPOSAL_STYLE = { color: '#ff3b30', opacity: 0.9 }

type Drag =
  | { mode: 'layer' | 'token'; id: string; x: number; y: number }
  | { mode: 'pan'; x: number; y: number }
  | { mode: 'calibrate'; startX: number; startY: number }
  | { mode: 'fog-rect'; startX: number; startY: number }
  | { mode: 'fog-brush'; last: { x: number; y: number } }
  | { mode: 'room-paint'; roomId: string; erase: boolean; last: { x: number; y: number } }

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
  const [picking, setPicking] = useState<'layer' | 'token' | null>(null)
  const [calibrating, setCalibrating] = useState(false)
  const [cellCount, setCellCount] = useState(1)
  const [marquee, setMarquee] = useState<ViewRect | null>(null)
  const [fogTool, setFogTool] = useState<FogTool | null>(null)
  const [brushCells, setBrushCells] = useState(2)
  /** Detected grid shown as a preview until the DM accepts or rejects it. */
  const [proposal, setProposal] = useState<Pick<Grid, 'size' | 'offsetX' | 'offsetY'> | null>(null)
  const [detectInfo, setDetectInfo] = useState<string | null>(null)
  const [paintingRoom, setPaintingRoom] = useState<string | null>(null)
  const [showRooms, setShowRooms] = useState(true)
  // The proposal is in scene coordinates of the moment it was found: moving the map or editing
  // the grid makes it stale, so drop it instead of accepting it in the wrong place.
  useEffect(() => {
    setProposal(null)
    setDetectInfo(null)
  }, [scene.layers, scene.grid])
  // The DM canvas is the source of truth while editing; this only changes to reload it from disk.
  const [fogVersion, setFogVersion] = useState(() => Date.now())
  const fogCanvas = useRef<HTMLCanvasElement>(null)
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
  const updateToken = (id: string, patch: Partial<Token>) =>
    setScene((s) => ({ ...s, tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  const updateGrid = (patch: Partial<Grid>) => setScene((s) => ({ ...s, grid: { ...s.grid, ...patch } }))

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

  function remove(id: string) {
    setScene((s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id), tokens: s.tokens.filter((t) => t.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  async function addLayer(asset: Asset) {
    setPicking(null)
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

  function addToken(asset: Asset) {
    setPicking(null)
    const at = scene.grid.snap ? snap(scene.grid, camera.x, camera.y, 1) : camera
    const token: Token = {
      id: crypto.randomUUID(),
      kind: asset.kind,
      name: asset.name,
      x: at.x,
      y: at.y,
      cells: 1,
      label: '',
      visible: true
    }
    setScene((s) => ({ ...s, tokens: [...s.tokens, token] }))
    setSelectedId(token.id)
  }

  async function detectGridProposal() {
    const layer = scene.layers.find((l) => l.id === selectedId) ?? scene.layers[0]
    if (!layer) return setDetectInfo('Erst eine Karte hinzufügen.')
    if (isVideo(layer.name)) return setDetectInfo(`${layer.name} ist ein Video, dort wird kein Raster gesucht.`)
    if (layer.rotation % 90 !== 0) return setDetectInfo('Nur bei Drehung in 90°-Schritten möglich.')
    setDetectInfo(`Suche Raster in ${layer.name}…`)
    try {
      const { data, width, height, scale } = await imagePixels(assetUrl(layer.kind, layer.name), DETECT_MAX_SIDE)
      const found = detectGrid(data, width, height)
      if (!found) {
        setProposal(null)
        setDetectInfo(`Kein gedrucktes Raster in ${layer.name} erkannt. Kalibrieren geht weiterhin von Hand.`)
        return
      }
      const grid = detectionToScene(found, layer, scale)
      setProposal(grid)
      setCalibrating(false)
      setDetectInfo(`Vorschlag (rot): ${grid.size.toLocaleString('de-DE', { maximumFractionDigits: 2 })} px pro Feld.`)
    } catch (err) {
      setDetectInfo(`Erkennung fehlgeschlagen: ${String(err)}`)
    }
  }

  function acceptProposal() {
    if (!proposal) return
    setScene((s) => ({ ...s, grid: { ...s.grid, ...proposal, type: 'square', visible: true } }))
    setProposal(null)
    setDetectInfo(null)
  }

  const bumpFogRevision = () =>
    setScene((s) => (s.fog ? { ...s, fog: { ...s.fog, revision: s.fog.revision + 1 } } : s))

  async function saveFogCanvas() {
    const canvas = fogCanvas.current
    if (!canvas) return
    try {
      await window.bellavellum.scenes.saveFog(scene.id, await canvasToPng(canvas))
      bumpFogRevision()
    } catch (err) {
      onError(`Fog speichern fehlgeschlagen: ${String(err)}`)
    }
  }

  /** Fits the fog area to the current scene and fills it completely. */
  async function resetFog(fogged: boolean) {
    const rect = sceneBounds(scene.layers)
    if (!rect) return
    try {
      await window.bellavellum.scenes.saveFog(scene.id, await solidMask(rect, fogged))
      setScene((s) => ({ ...s, fog: { enabled: true, rect, revision: (s.fog?.revision ?? 0) + 1 } }))
      setFogVersion(Date.now())
    } catch (err) {
      onError(`Fog speichern fehlgeschlagen: ${String(err)}`)
    }
  }

  function setFogEnabled(enabled: boolean) {
    if (enabled && !scene.fog) void resetFog(true)
    else setScene((s) => (s.fog ? { ...s, fog: { ...s.fog, enabled } } : s))
    if (!enabled) setFogTool(null)
  }

  const fogActive = scene.fog?.enabled ? scene.fog : null
  const tool = fogActive ? fogTool : null
  const fogCtx = () => fogCanvas.current?.getContext('2d') ?? null
  const brushWidth = (rect: ViewRect) => brushCells * scene.grid.size * maskScale(rect)

  function addRoom() {
    const n = scene.rooms.length
    const room: Room = {
      id: crypto.randomUUID(),
      name: `Raum ${n + 1}`,
      color: ROOM_COLORS[n % ROOM_COLORS.length],
      squares: []
    }
    setScene((s) => ({ ...s, rooms: [...s.rooms, room] }))
    startPainting(room.id)
  }

  function startPainting(id: string | null) {
    setPaintingRoom(id)
    if (id) {
      setFogTool(null)
      setCalibrating(false)
    }
  }

  /** Paints (or erases) every cell along the stroke from `from` to `to`: fast drags skip cells otherwise. */
  function paintRoom(id: string, erase: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
    setScene((s) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (s.grid.size / 4)))
      return {
        ...s,
        rooms: s.rooms.map((r) => {
          if (r.id !== id) return r
          for (let i = 0; i <= steps; i++) {
            const x = from.x + ((to.x - from.x) * i) / steps
            const y = from.y + ((to.y - from.y) * i) / steps
            r = erase ? eraseAt(r, x, y) : addSquare(r, cellAt(s.grid, x, y))
          }
          return r
        })
      }
    })
  }

  function fogRoom(id: string, mode: FogMode) {
    const ctx = fogCtx()
    const room = scene.rooms.find((r) => r.id === id)
    if (!ctx || !fogActive || !room) return
    for (const [x, y, s] of room.squares) {
      const a = toMask(fogActive.rect, x, y)
      const b = toMask(fogActive.rect, x + s, y + s)
      paintRect(ctx, mode, normalizeRect(a.x, a.y, b.x, b.y))
    }
    void saveFogCanvas()
  }

  const stagePoint = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return screenToWorld(camera, e.clientX - r.left, e.clientY - r.top, r.width, r.height)
  }

  // Tokens sit above layers. Among layers, the selected one wins if it is under the cursor.
  function hitTest(clientX: number, clientY: number): { id: string; token: boolean } | null {
    const hits = document
      .elementsFromPoint(clientX, clientY)
      .map((el) => el.closest<HTMLElement>('[data-token-id],[data-layer-id]'))
      .filter((el): el is HTMLElement => el !== null)
    const token = hits.find((el) => el.dataset['tokenId'])?.dataset['tokenId']
    if (token) return { id: token, token: true }
    const layers = hits.map((el) => el.dataset['layerId']).filter((v): v is string => v !== undefined)
    const layer = selectedId && layers.includes(selectedId) ? selectedId : layers[0]
    return layer ? { id: layer, token: false } : null
  }

  const drag = useRef<Drag | null>(null)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (e.button === 1) {
      drag.current = { mode: 'pan', x: e.clientX, y: e.clientY }
      return
    }
    if (calibrating || tool?.shape === 'rect') {
      const p = stagePoint(e)
      drag.current = calibrating
        ? { mode: 'calibrate', startX: p.x, startY: p.y }
        : { mode: 'fog-rect', startX: p.x, startY: p.y }
      setMarquee({ x: p.x, y: p.y, width: 0, height: 0 })
      return
    }
    if (paintingRoom) {
      const p = stagePoint(e)
      paintRoom(paintingRoom, e.altKey, p, p)
      drag.current = { mode: 'room-paint', roomId: paintingRoom, erase: e.altKey, last: p }
      return
    }
    if (tool?.shape === 'room') {
      const p = stagePoint(e)
      const room = roomAt(scene.rooms, p.x, p.y)
      if (room) fogRoom(room.id, 'reveal')
      return
    }
    if (tool && fogActive) {
      const p = stagePoint(e)
      const at = toMask(fogActive.rect, p.x, p.y)
      const ctx = fogCtx()
      if (ctx) paintLine(ctx, tool.mode, at, at, brushWidth(fogActive.rect))
      drag.current = { mode: 'fog-brush', last: at }
      return
    }
    const hit = hitTest(e.clientX, e.clientY)
    setSelectedId(hit?.id ?? null)
    drag.current = hit
      ? { mode: hit.token ? 'token' : 'layer', id: hit.id, x: e.clientX, y: e.clientY }
      : { mode: 'pan', x: e.clientX, y: e.clientY }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    if (d.mode === 'calibrate' || d.mode === 'fog-rect') {
      const p = stagePoint(e)
      setMarquee(normalizeRect(d.startX, d.startY, p.x, p.y))
      return
    }
    if (d.mode === 'room-paint') {
      const p = stagePoint(e)
      paintRoom(d.roomId, d.erase, d.last, p)
      d.last = p
      return
    }
    if (d.mode === 'fog-brush') {
      const ctx = fogCtx()
      if (!ctx || !fogActive || !tool) return
      const p = stagePoint(e)
      const at = toMask(fogActive.rect, p.x, p.y)
      paintLine(ctx, tool.mode, d.last, at, brushWidth(fogActive.rect))
      d.last = at
      return
    }
    const dx = (e.clientX - d.x) / camera.zoom
    const dy = (e.clientY - d.y) / camera.zoom
    d.x = e.clientX
    d.y = e.clientY
    if (d.mode === 'pan') setCamera((c) => ({ ...c, x: c.x - dx, y: c.y - dy }))
    else if (d.mode === 'layer') {
      const id = d.id
      setScene((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? { ...l, x: l.x + dx, y: l.y + dy } : l)) }))
    } else {
      const id = d.id
      setScene((s) => ({ ...s, tokens: s.tokens.map((t) => (t.id === id ? { ...t, x: t.x + dx, y: t.y + dy } : t)) }))
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    drag.current = null
    // Rectangles come from the release point: the marquee state may not include the last move yet.
    if (d?.mode === 'calibrate') {
      const p = stagePoint(e)
      const rect = normalizeRect(d.startX, d.startY, p.x, p.y)
      if (rect.width > 2 && rect.height > 2) {
        setScene((s) => ({ ...s, grid: { ...calibrate(s.grid, rect, cellCount), visible: true } }))
      }
      setMarquee(null)
      setCalibrating(false)
    } else if (d?.mode === 'fog-rect') {
      const ctx = fogCtx()
      if (ctx && fogActive && tool) {
        const p = stagePoint(e)
        const a = toMask(fogActive.rect, d.startX, d.startY)
        const b = toMask(fogActive.rect, p.x, p.y)
        paintRect(ctx, tool.mode, normalizeRect(a.x, a.y, b.x, b.y))
        void saveFogCanvas()
      }
      setMarquee(null)
    } else if (d?.mode === 'fog-brush') {
      void saveFogCanvas()
    } else if (d?.mode === 'token' && scene.grid.snap && !e.altKey) {
      const id = d.id
      setScene((s) => ({
        ...s,
        tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...snap(s.grid, t.x, t.y, t.cells) } : t))
      }))
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

  const selectedLayer = scene.layers.find((l) => l.id === selectedId)
  const selectedToken = scene.tokens.find((t) => t.id === selectedId)

  return (
    <div className="editor">
      <div className="scene-toolbar">
        <input
          aria-label="Szenenname"
          value={scene.name}
          onChange={(e) => setScene((s) => ({ ...s, name: e.target.value }))}
        />
        <button onClick={() => setPicking('layer')}>Ebene hinzufügen…</button>
        <button onClick={() => setPicking('token')}>Token hinzufügen…</button>
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
          className={calibrating || tool || paintingRoom ? 'stage calibrating' : 'stage'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onWheel={onWheel}
        >
          <SceneView
            scene={
              proposal
                ? { ...scene, grid: { ...scene.grid, ...proposal, type: 'square', visible: true, ...PROPOSAL_STYLE } }
                : scene
            }
            camera={camera}
            selectedId={selectedId}
            showViewFrame
            rooms={showRooms || paintingRoom ? { activeId: paintingRoom } : undefined}
            fog={{ version: fogVersion, dm: true, canvasRef: fogCanvas }}
          >
            {marquee && (
              <div
                className="marquee"
                style={{
                  left: marquee.x,
                  top: marquee.y,
                  width: marquee.width,
                  height: marquee.height,
                  borderWidth: 2 / camera.zoom
                }}
              />
            )}
          </SceneView>
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
                <button aria-label={`${l.name} entfernen`} onClick={() => remove(l.id)}>
                  ×
                </button>
              </li>
            ))}
          </ol>

          {scene.tokens.length > 0 && (
            <>
              <h2>Tokens</h2>
              <ol className="layers">
                {scene.tokens.map((t) => (
                  <li key={t.id} className={t.id === selectedId ? 'selected' : undefined}>
                    <input
                      type="checkbox"
                      aria-label={`${t.label || t.name} sichtbar`}
                      checked={t.visible}
                      onChange={(e) => updateToken(t.id, { visible: e.target.checked })}
                    />
                    <button className="layer-name" title={t.name} onClick={() => setSelectedId(t.id)}>
                      {t.label || t.name}
                    </button>
                    <button aria-label={`${t.label || t.name} entfernen`} onClick={() => remove(t.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}

          <GridPanel
            grid={scene.grid}
            onChange={updateGrid}
            calibrating={calibrating}
            onCalibrate={() => {
              setCalibrating((c) => !c)
              setFogTool(null)
              setPaintingRoom(null)
            }}
            cellCount={cellCount}
            onCellCount={setCellCount}
            detectInfo={detectInfo}
            hasProposal={proposal !== null}
            onDetect={() => void detectGridProposal()}
            onAcceptProposal={acceptProposal}
            onRejectProposal={() => {
              setProposal(null)
              setDetectInfo(null)
            }}
          />

          <FogPanel
            fog={scene.fog}
            hasLayers={scene.layers.length > 0}
            tool={tool}
            onTool={(t) => {
              setFogTool(t)
              setCalibrating(false)
              setPaintingRoom(null)
            }}
            brushCells={brushCells}
            onBrushCells={setBrushCells}
            onEnabled={setFogEnabled}
            onReset={(fogged) => void resetFog(fogged)}
          />

          <RoomPanel
            rooms={scene.rooms}
            paintingId={paintingRoom}
            fogActive={fogActive !== null}
            showRooms={showRooms}
            onShowRooms={setShowRooms}
            onAdd={addRoom}
            onPaint={startPainting}
            onRename={(id, name) =>
              setScene((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, name } : r)) }))
            }
            onRemove={(id) => {
              setScene((s) => ({ ...s, rooms: s.rooms.filter((r) => r.id !== id) }))
              if (paintingRoom === id) setPaintingRoom(null)
            }}
            onFog={fogRoom}
          />

          {selectedLayer && <LayerProps layer={selectedLayer} onChange={(patch) => updateLayer(selectedLayer.id, patch)} />}
          {selectedToken && (
            <TokenProps
              token={selectedToken}
              onChange={(patch) => updateToken(selectedToken.id, patch)}
              onSnap={() => updateToken(selectedToken.id, snap(scene.grid, selectedToken.x, selectedToken.y, selectedToken.cells))}
            />
          )}
        </aside>
      </div>

      {picking && (
        <AssetPicker
          title={picking === 'layer' ? 'Ebene hinzufügen' : 'Token hinzufügen'}
          initialKind={picking === 'layer' ? 'maps' : 'tokens'}
          onPick={(a) => (picking === 'layer' ? void addLayer(a) : addToken(a))}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
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

interface TokenPropsProps {
  token: Token
  onChange: (patch: Partial<Token>) => void
  onSnap: () => void
}

function TokenProps({ token, onChange, onSnap }: TokenPropsProps) {
  return (
    <div className="props">
      <h2 title={token.name}>{token.label || token.name}</h2>
      <label className="prop">
        <span>Bezeichnung</span>
        <input value={token.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <NumberField label="Felder" value={token.cells} min={0.25} step={0.5} onChange={(cells) => onChange({ cells })} />
      <button onClick={onSnap}>Am Raster ausrichten</button>
    </div>
  )
}
