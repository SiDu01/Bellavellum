import { Fragment, useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { AREA_EFFECTS, type Area, type AreaEffect, type Asset, type Layer, type Scene, type Size, type Token, type Transient } from '../../shared/types'
import { baseOf, renameRefs } from '../../shared/assetPaths'
import { AssetPicker } from './AssetPicker'
import { fitCamera, layerBounds, sceneBounds, screenToWorld, zoomAt, type Camera } from './camera'
import { Icon } from './controls'
import { useConfirm } from './Dialog'
import { areaGeometry, frameAt, snapIn, snapToken } from './frames'
import { LayerProps, rotated90, TokenProps } from './LayerProps'
import { PlayerView } from './Player'
import { DEFAULT_AREA_COLOR, PointerMarks, SceneView } from './SceneView'
import { measure } from './thumbs'
import { useFogTool } from './tools/fog'
import { useGridTool } from './tools/grid'
import { useLayerEditTool } from './tools/layerEdit'
import { AREA_LABELS, useMeasureTool } from './tools/measure'
import { useRoomTool } from './tools/rooms'
import type { PanelTab, Tool, ToolContext } from './tools/tool'
import { useTransient } from './transient'
import { useSize } from './useSize'

const PANEL_TABS: [PanelTab, string][] = [
  ['layers', 'Ebenen'],
  ['grid', 'Raster'],
  ['fog', 'Nebel'],
  ['rooms', 'Räume']
]

const EFFECT_LABELS: Record<AreaEffect, string> = { fire: 'Feuer', poison: 'Gift', ice: 'Eis', darkness: 'Dunkelheit' }

/** Assumed while no player window is open. */
const FALLBACK_PLAYER: Size = { width: 1920, height: 1080 }

/** The editor's own drags; tool drags live in the tools. */
type Drag = { mode: 'layer' | 'token'; id: string; x: number; y: number } | { mode: 'pan'; x: number; y: number } | { mode: 'pointer' }

interface Props {
  initial: Scene
  /** False while another view (library, settings) is shown; the editor stays mounted. */
  active: boolean
  isLive: boolean
  onSaved: (scene: Scene) => void
  onGoLive: () => void
  onError: (message: string) => void
}

export function SceneEditor({ initial, active, isLive, onSaved, onGoLive, onError }: Props) {
  const [scene, setScene] = useState(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const [picking, setPicking] = useState<'layer' | 'token' | null>(null)
  const [pickingEffect, setPickingEffect] = useState<{ layerId: string; areaId: string } | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>('layers')
  const [playerSize, setPlayerSize] = useState<Size | null>(null)
  /** Choosing the player view: the camera moves under a fixed frame in the player's aspect ratio. */
  const [framing, setFraming] = useState(false)
  const [confirmDialog, ask] = useConfirm()
  const marks = useTransient()
  /** Players only get pings, pointer and measuring while this scene is live. */
  const send = (t: Transient) => {
    if (isLive) window.bellavellum.live.sendTransient(t)
  }
  useEffect(() => {
    void window.bellavellum.playerSize().then(setPlayerSize)
    return window.bellavellum.onPlayerSize(setPlayerSize)
  }, [])
  useEffect(
    () => window.bellavellum.library.onMoved(({ kind, from, to }) => setScene((s) => renameRefs(s, kind, from, to))),
    []
  )
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
  /** null patch removes the area. */
  const updateArea = (layerId: string, id: string, patch: Partial<Area> | null) =>
    setScene((s) => ({
      ...s,
      layers: s.layers.map((l) =>
        l.id !== layerId
          ? l
          : { ...l, areas: patch ? l.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) : l.areas.filter((a) => a.id !== id) }
      )
    }))

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
        locked: true,
        grids: [],
        areas: []
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
    const at = snapToken(scene, camera, 1)
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

  const selectedLayer = scene.layers.find((l) => l.id === selectedId)
  const selectedToken = scene.tokens.find((t) => t.id === selectedId)

  const toolsRef = useRef<Tool[]>([])
  const exclusive = useCallback(() => toolsRef.current.forEach((t) => t.reset()), [])
  const ctx: ToolContext = {
    scene,
    setScene,
    updateLayer,
    zoom: camera.zoom,
    tab: panelTab,
    selectedId,
    selectedLayer,
    exclusive,
    active,
    send,
    hitTest,
    onError
  }
  const gridTool = useGridTool(ctx)
  const fogTool = useFogTool(ctx)
  const measureTool = useMeasureTool(ctx)
  const layerEdit = useLayerEditTool(ctx)
  const roomTool = useRoomTool(ctx, fogTool)
  const tools: Tool[] = [gridTool, fogTool, measureTool, layerEdit, roomTool]
  toolsRef.current = tools
  const anyTool = tools.some((t) => t.active)

  // Escape ends framing, else the active tool. Text fields and open dialogs keep their own Escape.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return
      if (framing) setFraming(false)
      else exclusive()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, framing, exclusive])

  /** Each tab has its own tools; a tool of another tab must not stay active unseen. */
  const switchTab = (id: PanelTab) => {
    setPanelTab(id)
    exclusive()
  }

  const player = playerSize ?? FALLBACK_PLAYER
  // Largest player-shaped frame with some margin, in stage px.
  const frameW = Math.min(size.width * 0.9, size.height * 0.9 * (player.width / player.height))
  const frame = { width: frameW, height: (frameW * player.height) / player.width }

  function startFraming() {
    setFraming(true)
    exclusive()
    const v = scene.view
    if (v) setCamera({ x: v.x + v.width / 2, y: v.y + v.height / 2, zoom: Math.min(frame.width / v.width, frame.height / v.height) })
  }

  function acceptFrame() {
    const width = frame.width / camera.zoom
    const height = frame.height / camera.zoom
    setScene((s) => ({ ...s, view: { x: camera.x - width / 2, y: camera.y - height / 2, width, height } }))
    setFraming(false)
  }

  function ping(p: { x: number; y: number }) {
    const t: Transient = { type: 'ping', x: p.x, y: p.y }
    marks.apply(t)
    send(t)
  }

  const stagePoint = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return screenToWorld(camera, e.clientX - r.left, e.clientY - r.top, r.width, r.height)
  }

  const drag = useRef<Drag | null>(null)
  /** Index of the tool that took the current press; -1 while the editor handles it. */
  const owner = useRef(-1)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button > 2) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (e.button === 2) {
      ping(stagePoint(e))
      drag.current = { mode: 'pointer' }
      return
    }
    if (e.button === 1 || framing) {
      drag.current = { mode: 'pan', x: e.clientX, y: e.clientY }
      return
    }
    const p = stagePoint(e)
    owner.current = tools.findIndex((t) => t.down(e, p))
    if (owner.current >= 0) return
    const hit = hitTest(e.clientX, e.clientY)
    setSelectedId(hit?.id ?? null)
    const locked = hit && !hit.token && scene.layers.find((l) => l.id === hit.id)?.locked
    drag.current =
      hit && !locked
        ? { mode: hit.token ? 'token' : 'layer', id: hit.id, x: e.clientX, y: e.clientY }
        : { mode: 'pan', x: e.clientX, y: e.clientY }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const tool = tools[owner.current]
    if (tool) return tool.move(e, stagePoint(e))
    const d = drag.current
    if (!d) return
    if (d.mode === 'pointer') {
      const p = stagePoint(e)
      send({ type: 'pointer', x: p.x, y: p.y })
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
    const tool = tools[owner.current]
    owner.current = -1
    if (tool) return tool.up(e, stagePoint(e))
    const d = drag.current
    drag.current = null
    if (d?.mode === 'pointer') send({ type: 'pointer-end' })
    else if (d?.mode === 'token' && !e.altKey) {
      const id = d.id
      setScene((s) => ({ ...s, tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...snapToken(s, t, t.cells) } : t)) }))
    }
  }

  /** The release never came (focus lost, touch): drop every preview, here and on the player screen, without applying it. */
  function onPointerCancel() {
    tools[owner.current]?.cancel()
    owner.current = -1
    if (drag.current?.mode === 'pointer') send({ type: 'pointer-end' })
    drag.current = null
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
          className={anyTool ? 'stage calibrating' : 'stage'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={onWheel}
        >
          <SceneView
            scene={gridTool.preview}
            camera={camera}
            selectedId={selectedId}
            showViewFrame
            dm
            rooms={roomTool.roomsView}
            fog={fogTool.view}
          >
            {gridTool.overlay}
            {measureTool.overlay}
            <PointerMarks pings={marks.pings} pointer={null} zoom={camera.zoom} />
            {roomTool.overlay}
            {fogTool.overlay}
          </SceneView>
          {scene.layers.length === 0 && <p className="stage-hint">Leere Szene. „Ebene hinzufügen…“ wählt eine Karte.</p>}
          {!framing && (
            <span className="stage-help">
              Rechtsklick: Ping · rechts halten und ziehen: Zeiger{!isLive && ' (Spieler sehen es erst, wenn die Szene live ist)'}
            </span>
          )}
          {framing && (
            <div className="frame-mask" style={frame}>
              <span>
                Spieler sehen genau diesen Rahmen ({player.width} × {player.height}
                {!playerSize && ', Spielerfenster nicht offen'}). Ziehen verschiebt, Mausrad zoomt.
              </span>
            </div>
          )}
          {/* No tools over the framing mask. */}
          {!framing && panelTab === 'layers' && measureTool.toolbar}
          <div
            hidden={framing}
            className="floating-tools"
            role="toolbar"
            aria-label="Werkzeuge"
            // The stage captures the pointer on pointerdown, which would swallow the button's click.
            onPointerDown={(e) => e.stopPropagation()}
          >
            {panelTab !== 'rooms' && (
              <button aria-label="Auswählen" title="Auswählen" aria-pressed={!anyTool} onClick={exclusive}>
                <Icon name="near_me" />
              </button>
            )}
            {panelTab === 'layers' && (
              <>
                <button
                  aria-label="Ebene gesperrt"
                  title={selectedLayer?.locked === false ? 'Ausgewählte Ebene sperren' : 'Ausgewählte Ebene entsperren'}
                  aria-pressed={selectedLayer?.locked ?? false}
                  disabled={!selectedLayer}
                  onClick={() => selectedLayer && updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
                >
                  <Icon name={selectedLayer?.locked === false ? 'lock_open' : 'lock'} />
                </button>
                <button
                  aria-label="90° drehen"
                  title="Ausgewählte Ebene 90° drehen"
                  disabled={!selectedLayer || selectedLayer.locked}
                  onClick={() => selectedLayer && updateLayer(selectedLayer.id, { rotation: rotated90(selectedLayer.rotation) })}
                >
                  <Icon name="rotate_90_degrees_cw" />
                </button>
                <button aria-label="Einpassen" title="Einpassen" disabled={scene.layers.length === 0} onClick={fit}>
                  <Icon name="fit_screen" />
                </button>
                {layerEdit.toolbar}
              </>
            )}
            {panelTab === 'grid' && gridTool.toolbar}
            {panelTab === 'fog' && fogTool.toolbar}
            {panelTab === 'rooms' && roomTool.toolbar}
          </div>
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
              <button key={id} role="tab" aria-selected={panelTab === id} onClick={() => switchTab(id)}>
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
                    <Fragment key={l.id}>
                      <li className={l.id === selectedId ? 'selected' : undefined}>
                        <button className="layer-name" title={l.name} onClick={() => setSelectedId(l.id)}>
                          <span>{baseOf(l.name)}</span>
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
                        <button
                          className="icon-btn"
                          aria-label={`${l.name} entfernen`}
                          title="Entfernen"
                          onClick={() =>
                            l.grids.length + l.areas.length === 0
                              ? remove(l.id)
                              : ask({
                                  title: `Ebene „${l.name}“ entfernen?`,
                                  text: 'Ihre lokalen Raster und platzierten Flächen gehen mit verloren.',
                                  action: 'Entfernen',
                                  onConfirm: () => remove(l.id)
                                })
                          }
                        >
                          <Icon name="delete" />
                        </button>
                      </li>
                      {l.areas.map((a) => {
                        const feet = `${areaGeometry(scene, l, a).feet} ft`
                        const label = `${AREA_LABELS[a.shape]} ${feet}`
                        return (
                          <li key={a.id} className="sub area-row">
                            <input
                              className="area-name"
                              aria-label={`${label}: Beschriftung`}
                              title="Beschriftung in der Mitte der Fläche; leer zeigt das Maß"
                              value={a.label ?? feet}
                              onChange={(e) => updateArea(l.id, a.id, { label: e.target.value })}
                            />
                            <button
                              className="icon-btn"
                              aria-label={`${label} für Spieler sichtbar`}
                              aria-pressed={a.visible}
                              title={a.visible ? 'Spieler sehen die Fläche' : 'Nur für dich sichtbar'}
                              onClick={() => updateArea(l.id, a.id, { visible: !a.visible })}
                            >
                              <Icon name={a.visible ? 'visibility' : 'visibility_off'} />
                            </button>
                            <button className="icon-btn" aria-label={`${label} entfernen`} title="Entfernen" onClick={() => updateArea(l.id, a.id, null)}>
                              <Icon name="delete" />
                            </button>
                            <div className="area-style">
                              <input
                                type="color"
                                aria-label={`${label}: Farbe`}
                                title="Farbe (färbt auch den Effekt)"
                                value={a.color ?? DEFAULT_AREA_COLOR}
                                onChange={(e) => updateArea(l.id, a.id, { color: e.target.value })}
                              />
                              <select
                                aria-label={`${label}: Effekt`}
                                value={a.asset ? 'asset' : (a.effect ?? '')}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === 'asset') setPickingEffect({ layerId: l.id, areaId: a.id })
                                  else updateArea(l.id, a.id, { effect: (v || undefined) as AreaEffect | undefined, asset: undefined })
                                }}
                              >
                                <option value="">Kein Effekt</option>
                                {AREA_EFFECTS.map((fx) => (
                                  <option key={fx} value={fx}>
                                    {EFFECT_LABELS[fx]}
                                  </option>
                                ))}
                                <option value="asset">{a.asset ?? 'Datei …'}</option>
                              </select>
                              {/* Re-picking the selected "asset" option fires no change event. */}
                              <button
                                className="icon-btn"
                                aria-label={`${label}: Effekt-Datei wählen`}
                                title="Effekt-Datei wählen"
                                onClick={() => setPickingEffect({ layerId: l.id, areaId: a.id })}
                              >
                                <Icon name="folder_open" />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </Fragment>
                  ))}
                </ol>

                {measureTool.info && (
                  <p className="hint" role="status">
                    {measureTool.info}
                  </p>
                )}

                {scene.tokens.length > 0 && (
                  <>
                    <h2>Tokens</h2>
                    <ol className="layers">
                      {scene.tokens.map((t) => (
                        <li key={t.id} className={t.id === selectedId ? 'selected' : undefined}>
                          <button className="layer-name" title={t.name} onClick={() => setSelectedId(t.id)}>
                            <span>{t.label || baseOf(t.name)}</span>
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
                          <button className="icon-btn" aria-label={`${t.label || t.name} entfernen`} title="Entfernen" onClick={() => remove(t.id)}>
                            <Icon name="delete" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  </>
                )}

                {selectedLayer && (
                  <LayerProps
                    layer={selectedLayer}
                    onChange={(patch) => updateLayer(selectedLayer.id, patch)}
                    onSplit={(cols, rows) => layerEdit.split(selectedLayer, cols, rows)}
                    onSaveImage={() => void layerEdit.saveImage(selectedLayer)}
                    info={layerEdit.info}
                  />
                )}
                {selectedToken && (
                  <TokenProps
                    token={selectedToken}
                    onChange={(patch) => updateToken(selectedToken.id, patch)}
                    onSnap={() => updateToken(selectedToken.id, snapIn(frameAt(scene, selectedToken), selectedToken, selectedToken.cells))}
                  />
                )}
              </>
            )}
            {panelTab === 'grid' && gridTool.panel}
            {panelTab === 'fog' && fogTool.panel}
            {panelTab === 'rooms' && roomTool.panel}
          </div>
        </aside>
      </div>

      {confirmDialog}
      {picking && (
        <AssetPicker
          title={picking === 'layer' ? 'Ebene hinzufügen' : 'Token hinzufügen'}
          initialKind={picking === 'layer' ? 'maps' : 'tokens'}
          onPick={(a) => (picking === 'layer' ? void addLayer(a) : addToken(a))}
          onClose={() => setPicking(null)}
        />
      )}
      {pickingEffect && (
        <AssetPicker
          title="Effekt für die Fläche"
          initialKind="effects"
          onPick={(asset) => {
            updateArea(pickingEffect.layerId, pickingEffect.areaId, { asset: asset.name, effect: undefined })
            setPickingEffect(null)
          }}
          onClose={() => setPickingEffect(null)}
        />
      )}
    </div>
  )
}
