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
  type Size,
  type Token,
  type ViewRect
} from '../../shared/types'
import { AssetPicker } from './AssetPicker'
import { fitCamera, layerBounds, sceneBounds, screenToWorld, zoomAt, type Camera } from './camera'
import { Icon, NumberField, Slider } from './controls'
import { canvasToPng, maskScale, paintLine, paintRect, solidMask, toMask, type FogMode } from './fog'
import { FOG_TOOLS, FogPanel, same, type FogTool } from './FogPanel'
import { calibrate, normalizeRect, snap } from './grid'
import { detectGrid, detectionToScene } from './gridDetect'
import { GridPanel } from './GridPanel'
import { RoomPanel, type RoomTool } from './RoomPanel'
import { addSquare, addSquares, cellAt, cellsInRect, eraseAt, eraseRect, ROOM_COLORS, roomAt } from './rooms'
import { PlayerView } from './Player'
import { SceneView } from './SceneView'
import { imagePixels, isVideo, measure, squareColors } from './thumbs'
import { cellsInPolygon, insidePolygon, pickFloor, type Point } from './wand'
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

type PanelTab = 'layers' | 'grid' | 'fog' | 'rooms'
const PANEL_TABS: [PanelTab, string][] = [
  ['layers', 'Ebenen'],
  ['grid', 'Raster'],
  ['fog', 'Nebel'],
  ['rooms', 'Räume']
]
/** Assumed while no player window is open. */
const FALLBACK_PLAYER: Size = { width: 1920, height: 1080 }

type Drag =
  | { mode: 'layer' | 'token'; id: string; x: number; y: number }
  | { mode: 'pan'; x: number; y: number }
  | { mode: 'calibrate'; startX: number; startY: number }
  | { mode: 'fog-rect'; startX: number; startY: number }
  | { mode: 'fog-brush'; last: { x: number; y: number } }
  | { mode: 'room-paint'; roomId: string; erase: boolean; last: { x: number; y: number } }
  | { mode: 'room-rect'; roomId: string; erase: boolean; startX: number; startY: number }
  | { mode: 'room-lasso'; roomId: string; erase: boolean; points: Point[] }

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
  const [panelTab, setPanelTab] = useState<PanelTab>('layers')
  const [brushCells, setBrushCells] = useState(2)
  /** Detected grid shown as a preview until the DM accepts or rejects it. */
  const [proposal, setProposal] = useState<Pick<Grid, 'size' | 'offsetX' | 'offsetY'> | null>(null)
  const [detectInfo, setDetectInfo] = useState<string | null>(null)
  const [paintingRoom, setPaintingRoom] = useState<string | null>(null)
  const [showRooms, setShowRooms] = useState(true)
  const [roomTool, setRoomTool] = useState<RoomTool>({ shape: 'brush', erase: false })
  const [tolerance, setTolerance] = useState(50)
  const [lasso, setLasso] = useState<Point[] | null>(null)
  const [wandInfo, setWandInfo] = useState<string | null>(null)
  const [playerSize, setPlayerSize] = useState<Size | null>(null)
  /** Choosing the player view: the camera moves under a fixed frame in the player's aspect ratio. */
  const [framing, setFraming] = useState(false)
  useEffect(() => {
    void window.bellavellum.playerSize().then(setPlayerSize)
    return window.bellavellum.onPlayerSize(setPlayerSize)
  }, [])
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
    const prev = saved.current
    saved.current = current
    try {
      await window.bellavellum.scenes.save(current)
      onSaved(current)
    } catch (err) {
      // Not on disk: let the next flush (next edit or closing the editor) try again.
      if (saved.current === current) saved.current = prev
      onError(`Speichern fehlgeschlagen: ${String(err)}`)
    }
  }, [onSaved, onError])
  useEffect(() => {
    const timer = setTimeout(() => void flush(), 300)
    return () => clearTimeout(timer)
  }, [scene, flush])
  useEffect(() => () => void flush(), [flush])
  // Closing the window skips unmount. beforeunload still runs early enough for the request to reach main;
  // pagehide does not.
  useEffect(() => {
    const onClose = () => void flush()
    window.addEventListener('beforeunload', onClose)
    return () => window.removeEventListener('beforeunload', onClose)
  }, [flush])

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
        visible: true,
        // Placed at the camera center; the DM unlocks it to position it.
        locked: true
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
    const canvas = readyFogCanvas()
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
  const chooseFogTool = (t: FogTool | null) => {
    setFogTool(t)
    setCalibrating(false)
    setPaintingRoom(null)
  }
  // Painting before the saved mask has loaded would save "all fogged + stroke" over it.
  const readyFogCanvas = () => (fogCanvas.current?.dataset['ready'] ? fogCanvas.current : null)
  const fogCtx = () => readyFogCanvas()?.getContext('2d') ?? null
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

  async function applyLasso(id: string, erase: boolean, points: Point[]) {
    const grid = scene.grid
    if (erase) {
      setScene((s) => ({
        ...s,
        rooms: s.rooms.map((r) =>
          r.id !== id ? r : { ...r, squares: r.squares.filter(([x, y, q]) => !insidePolygon(points, x + q / 2, y + q / 2)) }
        )
      }))
      return
    }
    const cells = cellsInPolygon(grid, points)
    if (cells.length === 0) return setWandInfo('Umriss zu klein: kein Feldmittelpunkt liegt darin.')
    try {
      const picked = pickFloor(cells, await squareColors(scene.layers, cells), tolerance)
      setScene((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? addSquares(r, picked) : r)) }))
      setWandInfo(`${picked.length} von ${cells.length} Feldern im Umriss übernommen.`)
    } catch (err) {
      setWandInfo(`Zauberstab fehlgeschlagen: ${String(err)}`)
    }
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

  const player = playerSize ?? FALLBACK_PLAYER
  // Largest player-shaped frame with some margin, in stage px.
  const frameW = Math.min(size.width * 0.9, size.height * 0.9 * (player.width / player.height))
  const frame = { width: frameW, height: (frameW * player.height) / player.width }

  function startFraming() {
    setFraming(true)
    setFogTool(null)
    setCalibrating(false)
    setPaintingRoom(null)
    const v = scene.view
    if (v) setCamera({ x: v.x + v.width / 2, y: v.y + v.height / 2, zoom: Math.min(frame.width / v.width, frame.height / v.height) })
  }

  function acceptFrame() {
    const width = frame.width / camera.zoom
    const height = frame.height / camera.zoom
    setScene((s) => ({ ...s, view: { x: camera.x - width / 2, y: camera.y - height / 2, width, height } }))
    setFraming(false)
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
    if (e.button === 1 || framing) {
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
      const erase = roomTool.erase !== e.altKey
      if (roomTool.shape === 'rect') {
        drag.current = { mode: 'room-rect', roomId: paintingRoom, erase, startX: p.x, startY: p.y }
        setMarquee({ x: p.x, y: p.y, width: 0, height: 0 })
      } else if (roomTool.shape === 'wand') {
        drag.current = { mode: 'room-lasso', roomId: paintingRoom, erase, points: [p] }
        setLasso([p])
      } else {
        paintRoom(paintingRoom, erase, p, p)
        drag.current = { mode: 'room-paint', roomId: paintingRoom, erase, last: p }
      }
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
    const locked = hit && !hit.token && scene.layers.find((l) => l.id === hit.id)?.locked
    drag.current =
      hit && !locked
        ? { mode: hit.token ? 'token' : 'layer', id: hit.id, x: e.clientX, y: e.clientY }
        : { mode: 'pan', x: e.clientX, y: e.clientY }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    if (d.mode === 'calibrate' || d.mode === 'fog-rect' || d.mode === 'room-rect') {
      const p = stagePoint(e)
      setMarquee(normalizeRect(d.startX, d.startY, p.x, p.y))
      return
    }
    if (d.mode === 'room-lasso') {
      d.points.push(stagePoint(e))
      setLasso([...d.points])
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
    } else if (d?.mode === 'room-rect') {
      const p = stagePoint(e)
      const rect = normalizeRect(d.startX, d.startY, p.x, p.y)
      setScene((s) => ({
        ...s,
        rooms: s.rooms.map((r) =>
          r.id !== d.roomId ? r : d.erase ? eraseRect(r, rect) : addSquares(r, cellsInRect(s.grid, rect))
        )
      }))
      setMarquee(null)
    } else if (d?.mode === 'room-lasso') {
      setLasso(null)
      void applyLasso(d.roomId, d.erase, d.points)
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
        <label className="text-field">
          Szenenname
          <input value={scene.name} onChange={(e) => setScene((s) => ({ ...s, name: e.target.value }))} />
        </label>
        <button className="icon-btn" aria-label="Ebene hinzufügen" title="Ebene hinzufügen" onClick={() => setPicking('layer')}>
          <Icon name="add_photo_alternate" />
        </button>
        <button className="icon-btn" aria-label="Token hinzufügen" title="Token hinzufügen" onClick={() => setPicking('token')}>
          <Icon name="person_add" />
        </button>
        <button className="icon-btn" aria-label="Einpassen" title="Einpassen" onClick={fit} disabled={scene.layers.length === 0}>
          <Icon name="fit_screen" />
        </button>
        <span className="spacer" />
        {framing ? (
          <>
            <button className="text" onClick={() => setFraming(false)}>
              Abbrechen
            </button>
            <button className="primary" onClick={acceptFrame}>
              Ausschnitt übernehmen
            </button>
          </>
        ) : (
          <div className="segmented" role="group" aria-label="Spieleransicht">
            <button
              aria-label="Ganze Szene für Spieler"
              title="Ganze Szene für Spieler"
              aria-pressed={!scene.view}
              onClick={() => setScene((s) => ({ ...s, view: null }))}
            >
              <Icon name="panorama" />
            </button>
            <button
              aria-label="Ausschnitt für Spieler"
              title="Ausschnitt für Spieler…"
              aria-pressed={scene.view !== null}
              onClick={startFraming}
              disabled={scene.layers.length === 0}
            >
              <Icon name="crop" />
            </button>
          </div>
        )}
        <button className={isLive ? 'live' : 'primary'} onClick={() => void goLive()} disabled={isLive}>
          <Icon name="cast" />
          {isLive ? 'Live' : 'Live schalten'}
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
            {lasso && (
              <svg className="lasso">
                <polyline
                  points={lasso.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgb(201 164 92 / 0.15)"
                  stroke="var(--primary)"
                  strokeWidth={2 / camera.zoom}
                />
              </svg>
            )}
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
          {framing && (
            <div className="frame-mask" style={frame}>
              <span>
                Spieler sehen genau diesen Rahmen ({player.width} × {player.height}
                {!playerSize && ', Spielerfenster nicht offen'}). Ziehen verschiebt, Mausrad zoomt.
              </span>
            </div>
          )}
          {fogActive && (
            <div className="floating-tools" role="toolbar" aria-label="Nebel-Werkzeuge">
              <button aria-label="Auswählen" title="Auswählen" aria-pressed={tool === null} onClick={() => chooseFogTool(null)}>
                <Icon name="near_me" />
              </button>
              {FOG_TOOLS.map(({ label, icon, tool: t }) => (
                <button
                  key={label}
                  aria-label={label}
                  title={label}
                  aria-pressed={same(tool, t)}
                  onClick={() => chooseFogTool(same(tool, t) ? null : t)}
                >
                  <Icon name={icon} />
                </button>
              ))}
            </div>
          )}
          <span className="zoom">{Math.round(camera.zoom * 100)} %</span>
        </div>

        <aside className="panel">
          <details className="preview" open>
            <summary>Spieleransicht</summary>
            <div style={{ aspectRatio: `${player.width} / ${player.height}` }}>
              <PlayerView className="player-preview" />
            </div>
          </details>

          <div className="panel-tabs" role="tablist" aria-label="Bereiche">
            {PANEL_TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={panelTab === id} onClick={() => setPanelTab(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="panel-body">
            {panelTab === 'layers' && (
              <>
                <h2>Ebenen</h2>
                <ol className="layers">
                  {[...scene.layers].reverse().map((l) => (
                    <li key={l.id} className={l.id === selectedId ? 'selected' : undefined}>
                      <button className="layer-name" title={l.name} onClick={() => setSelectedId(l.id)}>
                        {l.name}
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`${l.name} sichtbar`}
                        aria-pressed={l.visible}
                        title={l.visible ? 'Sichtbar' : 'Ausgeblendet'}
                        onClick={() => updateLayer(l.id, { visible: !l.visible })}
                      >
                        <Icon name={l.visible ? 'visibility' : 'visibility_off'} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`${l.name} gesperrt`}
                        aria-pressed={l.locked}
                        title={l.locked ? 'Gesperrt: zum Verschieben entsperren' : 'Entsperrt: sperren'}
                        onClick={() => updateLayer(l.id, { locked: !l.locked })}
                      >
                        <Icon name={l.locked ? 'lock' : 'lock_open'} />
                      </button>
                      <button className="icon-btn" aria-label={`${l.name} nach oben`} title="Nach oben" onClick={() => moveLayer(l.id, 1)}>
                        <Icon name="arrow_upward" />
                      </button>
                      <button className="icon-btn" aria-label={`${l.name} nach unten`} title="Nach unten" onClick={() => moveLayer(l.id, -1)}>
                        <Icon name="arrow_downward" />
                      </button>
                      <button className="icon-btn" aria-label={`${l.name} entfernen`} title="Entfernen" onClick={() => remove(l.id)}>
                        <Icon name="delete" />
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
                          <button className="layer-name" title={t.name} onClick={() => setSelectedId(t.id)}>
                            {t.label || t.name}
                          </button>
                          <button
                            className="icon-btn"
                            aria-label={`${t.label || t.name} sichtbar`}
                            aria-pressed={t.visible}
                            title={t.visible ? 'Sichtbar' : 'Ausgeblendet'}
                            onClick={() => updateToken(t.id, { visible: !t.visible })}
                          >
                            <Icon name={t.visible ? 'visibility' : 'visibility_off'} />
                          </button>
                          <button
                            className="icon-btn"
                            aria-label={`${t.label || t.name} entfernen`}
                            title="Entfernen"
                            onClick={() => remove(t.id)}
                          >
                            <Icon name="delete" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  </>
                )}

                {selectedLayer && <LayerProps layer={selectedLayer} onChange={(patch) => updateLayer(selectedLayer.id, patch)} />}
                {selectedToken && (
                  <TokenProps
                    token={selectedToken}
                    onChange={(patch) => updateToken(selectedToken.id, patch)}
                    onSnap={() => updateToken(selectedToken.id, snap(scene.grid, selectedToken.x, selectedToken.y, selectedToken.cells))}
                  />
                )}
              </>
            )}

            {panelTab === 'grid' && (
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
            )}

            {panelTab === 'fog' && (
              <FogPanel
                fog={scene.fog}
                hasLayers={scene.layers.length > 0}
                tool={tool}
                onTool={chooseFogTool}
                brushCells={brushCells}
                onBrushCells={setBrushCells}
                onEnabled={setFogEnabled}
                onReset={(fogged) => void resetFog(fogged)}
              />
            )}

            {panelTab === 'rooms' && (
              <RoomPanel
                rooms={scene.rooms}
                paintingId={paintingRoom}
                tool={roomTool}
                onTool={setRoomTool}
                tolerance={tolerance}
                onTolerance={setTolerance}
                wandInfo={wandInfo}
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
            )}
          </div>
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
      </fieldset>
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
