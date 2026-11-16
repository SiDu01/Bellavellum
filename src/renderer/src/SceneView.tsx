import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import {
  assetUrl,
  type Area,
  type Crop,
  type Fog,
  type Grid,
  type Layer,
  type Room,
  type Scene,
  type Token,
  type ViewRect
} from '../../shared/types'
import { sceneBounds, type Camera } from './camera'
import { fogUrl, maskSize, paintRect } from './fog'
import { roomBounds } from './rooms'
import { areaGeometry, cellSizeAt } from './frames'
import { hexRadius } from './grid'
import { isVideo } from './thumbs'

const pct = (f: number) => `${f * 100}%`

function placement(l: Layer): CSSProperties {
  return {
    left: l.x,
    top: l.y,
    width: l.width,
    height: l.height,
    transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scale(${l.scale})`
  }
}

const inset = (c: Crop) => `inset(${pct(c.top)} ${pct(c.right)} ${pct(c.bottom)} ${pct(c.left)})`

function Media({ kind, name, ...props }: { kind: Layer['kind']; name: string; className?: string; style?: CSSProperties }) {
  const url = assetUrl(kind, name)
  return isVideo(name) ? (
    <video {...props} src={url} autoPlay loop muted playsInline />
  ) : (
    <img {...props} src={url} alt="" draggable={false} />
  )
}

function LayerMedia({ layer }: { layer: Layer }) {
  const style: CSSProperties = {
    ...placement(layer),
    opacity: layer.opacity,
    mixBlendMode: layer.blend,
    clipPath: inset(layer.crop)
  }
  return (
    <div className="layer" data-layer-id={layer.id} style={style}>
      <Media kind={layer.kind} name={layer.name} />
    </div>
  )
}

function hexPath(cx: number, cy: number, r: number): string {
  const corners = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = ((60 * i - 90) * Math.PI) / 180
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  })
  return `M${corners.join('L')}Z`
}

function GridOverlay({ grid, bounds, zoom }: { grid: Grid; bounds: ViewRect; zoom: number }) {
  const id = `grid${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const s = grid.size
  const stroke = { fill: 'none', stroke: grid.color, strokeWidth: 1.5 / zoom }
  let pattern: ReactNode
  if (grid.type === 'square') {
    // All four edges: each tile draws half of every shared line, together a full one.
    pattern = (
      <pattern id={id} patternUnits="userSpaceOnUse" x={grid.offsetX} y={grid.offsetY} width={s} height={s}>
        <path d={`M0 0H${s}V${s}H0Z`} {...stroke} />
      </pattern>
    )
  } else {
    // Pointy-top tile with a hex centered at (s/2, r); flat-top mirrors it across the diagonal.
    const r = hexRadius(s)
    const flat = grid.type === 'hex-flat'
    const [ox, oy] = flat ? [grid.offsetY, grid.offsetX] : [grid.offsetX, grid.offsetY]
    const centers = [
      [s / 2, r],
      [0, 2.5 * r],
      [s, 2.5 * r],
      [0, -0.5 * r],
      [s, -0.5 * r]
    ]
    pattern = (
      <pattern
        id={id}
        patternUnits="userSpaceOnUse"
        x={ox - s / 2}
        y={oy - r}
        width={s}
        height={3 * r}
        patternTransform={flat ? 'matrix(0 1 1 0 0 0)' : undefined}
      >
        <path d={centers.map(([cx = 0, cy = 0]) => hexPath(cx, cy, r)).join('')} {...stroke} />
      </pattern>
    )
  }
  return (
    <svg
      className="grid-overlay"
      style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, opacity: grid.opacity }}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
    >
      <defs>{pattern}</defs>
      <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={`url(#${id})`} />
    </svg>
  )
}

/** A layer's own grids, in its px: they follow its position, scale, rotation and crop. */
function LocalGrids({ layer, zoom }: { layer: Layer; zoom: number }) {
  const grids = layer.grids.filter((g) => g.visible)
  if (grids.length === 0) return null
  return (
    <div className="layer-grids" style={{ ...placement(layer), clipPath: inset(layer.crop) }}>
      {grids.map((g) => (
        <div key={g.id} className="local-grid" style={{ transform: `rotate(${g.rotation}deg)` }}>
          <GridOverlay grid={g} bounds={g.region} zoom={zoom * layer.scale} />
        </div>
      ))}
    </div>
  )
}

const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(' ')

/** A PF2e area or ruler, in scene coordinates. Hidden ones are dashed: only the DM gets them. */
export function AreaView({ scene, layer, area, zoom }: { scene: Scene; layer: Layer | null; area: Area; zoom: number }) {
  const g = areaGeometry(scene, layer, area)
  const w = 2 / zoom
  return (
    <>
      <svg className="area">
        {g.cells.map((q, i) => (
          <polygon key={i} points={pts(q)} className="area-cell" strokeWidth={w / 2} />
        ))}
        <polyline
          points={pts([g.from, g.to])}
          className="area-line"
          strokeWidth={w}
          strokeDasharray={area.visible ? undefined : `${6 / zoom} ${4 / zoom}`}
        />
        <circle cx={g.from.x} cy={g.from.y} r={4 / zoom} className="area-origin" />
      </svg>
      <span className="area-label" style={{ left: g.to.x, top: g.to.y, fontSize: 14 / zoom }}>
        {g.feet} ft
      </span>
    </>
  )
}

/** Pings fade by CSS; the pointer is a dot. Both in scene coordinates, sized in screen px. */
export function PointerMarks({ pings, pointer, zoom }: { pings: Ping[]; pointer: { x: number; y: number } | null; zoom: number }) {
  return (
    <>
      {pings.map((p) => (
        <span key={p.id} className="ping" style={{ left: p.x, top: p.y, width: 80 / zoom, height: 80 / zoom, borderWidth: 4 / zoom }} />
      ))}
      {pointer && <span className="pointer-dot" style={{ left: pointer.x, top: pointer.y, width: 18 / zoom, height: 18 / zoom }} />}
    </>
  )
}

export interface Ping {
  id: number
  x: number
  y: number
}

function tokenBox(t: Token, cellSize: number): CSSProperties {
  const w = t.cells * cellSize
  return { left: t.x - w / 2, top: t.y - w / 2, width: w, height: w }
}

function TokenView({ token, cellSize }: { token: Token; cellSize: number }) {
  return (
    <div className="token" data-token-id={token.id} style={tokenBox(token, cellSize)}>
      <Media kind={token.kind} name={token.name} />
      {token.label && (
        <span className="token-label" style={{ fontSize: Math.max(cellSize * 0.3, 6) }}>
          {token.label}
        </span>
      )}
    </div>
  )
}

interface FogProps {
  sceneId: string
  fog: Fog
  /** Changing it reloads the mask from disk. */
  version: number
  /** The DM sees through the fog; players do not. */
  dm: boolean
  canvasRef?: RefObject<HTMLCanvasElement | null>
}

function FogLayer({ sceneId, fog, version, dm, canvasRef }: FogProps) {
  const own = useRef<HTMLCanvasElement>(null)
  const ref = canvasRef ?? own
  const { width, height } = maskSize(fog.rect)

  // A new or resized canvas starts transparent: cover everything before the first paint.
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) paintRect(ctx, 'hide', { x: 0, y: 0, width, height })
  }, [ref, width, height])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // Until the saved mask is drawn, the canvas is a placeholder; the DM editor must not save it.
    delete canvas.dataset['ready']
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = fogUrl(sceneId, version)
    // Decode first, then swap, so the players never see a flash of the uncovered map.
    img.decode().then(
      () => {
        if (cancelled) return
        ctx.globalCompositeOperation = 'source-over'
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        canvas.dataset['ready'] = '1'
      },
      () => {
        // No mask saved yet: everything stays hidden.
        if (cancelled) return
        paintRect(ctx, 'hide', { x: 0, y: 0, width, height })
        canvas.dataset['ready'] = '1'
      }
    )
    return () => {
      cancelled = true
    }
  }, [ref, sceneId, version, width, height])

  return (
    <canvas
      ref={ref}
      className={dm ? 'fog fog-dm' : 'fog'}
      width={width}
      height={height}
      style={{ left: fog.rect.x, top: fog.rect.y, width: fog.rect.width, height: fog.rect.height }}
    />
  )
}

function RoomOverlay({ room, zoom, active }: { room: Room; zoom: number; active: boolean }) {
  const b = roomBounds(room)
  if (!b) return null
  const path = room.squares.map(([x, y, s]) => `M${x} ${y}h${s}v${s}h${-s}Z`).join('')
  return (
    <>
      <svg
        className="room-overlay"
        style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
        viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}
      >
        <path d={path} fill={room.color} fillOpacity={active ? 0.5 : 0.3} />
      </svg>
      <span
        className="room-label"
        style={{ left: b.x + b.width / 2, top: b.y + b.height / 2, fontSize: 14 / zoom }}
      >
        {room.name}
      </span>
    </>
  )
}

interface Props {
  scene: Scene
  camera: Camera
  selectedId?: string | null
  /** DM only: outline of what the players see. */
  showViewFrame?: boolean
  /** The DM also sees areas hidden from the players. */
  dm?: boolean
  /** DM only: painted rooms, the active one stronger. */
  rooms?: { activeId: string | null }
  fog?: Omit<FogProps, 'sceneId' | 'fog'>
  /** Extra content in scene coordinates (e.g. the calibration rectangle). */
  children?: ReactNode
}

const polygon = (r: ViewRect) =>
  `polygon(${r.x}px ${r.y}px, ${r.x + r.width}px ${r.y}px, ${r.x + r.width}px ${r.y + r.height}px, ${r.x}px ${r.y + r.height}px)`

/** Renders a scene. Used by the DM editor and the player window, so both show the same thing. */
export function SceneView({ scene, camera, selectedId, showViewFrame, dm, rooms, fog, children }: Props) {
  const activeFog = fog && scene.fog?.enabled ? scene.fog : null
  const zoom = camera.zoom
  const layers = scene.layers.filter((l) => l.visible)
  const tokens = scene.tokens.filter((t) => t.visible)
  const bounds = scene.grid.visible ? sceneBounds(layers) : null
  const selectedLayer = layers.find((l) => l.id === selectedId)
  const selectedToken = tokens.find((t) => t.id === selectedId)
  const view = showViewFrame ? scene.view : null
  return (
    <div
      className="world"
      style={{
        transform: `scale(${zoom}) translate(${-camera.x}px, ${-camera.y}px)`,
        // Players see nothing outside the fog area, e.g. a layer moved there later.
        clipPath: activeFog && !fog?.dm ? polygon(activeFog.rect) : undefined
      }}
    >
      {layers.map((l) => (
        <LayerMedia key={l.id} layer={l} />
      ))}
      {bounds && <GridOverlay grid={scene.grid} bounds={bounds} zoom={zoom} />}
      {layers.map((l) => (
        <LocalGrids key={l.id} layer={l} zoom={zoom} />
      ))}
      {layers.flatMap((l) =>
        l.areas.filter((a) => dm || a.visible).map((a) => <AreaView key={a.id} scene={scene} layer={l} area={a} zoom={zoom} />)
      )}
      {tokens.map((t) => (
        <TokenView key={t.id} token={t} cellSize={cellSizeAt(scene, t)} />
      ))}
      {fog && activeFog && <FogLayer sceneId={scene.id} fog={activeFog} {...fog} />}
      {rooms &&
        scene.rooms.map((r) => <RoomOverlay key={r.id} room={r} zoom={zoom} active={r.id === rooms.activeId} />)}
      {selectedLayer && (
        <div className="selection" style={placement(selectedLayer)}>
          <div
            style={{
              top: pct(selectedLayer.crop.top),
              right: pct(selectedLayer.crop.right),
              bottom: pct(selectedLayer.crop.bottom),
              left: pct(selectedLayer.crop.left),
              borderWidth: 2 / (zoom * selectedLayer.scale)
            }}
          />
        </div>
      )}
      {selectedToken && (
        <div className="selection" style={tokenBox(selectedToken, cellSizeAt(scene, selectedToken))}>
          <div style={{ inset: 0, borderWidth: 2 / zoom }} />
        </div>
      )}
      {view && (
        <div
          className="view-frame"
          style={{ left: view.x, top: view.y, width: view.width, height: view.height, borderWidth: 2 / zoom }}
        />
      )}
      {children}
    </div>
  )
}
