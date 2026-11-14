import { useId, type CSSProperties, type ReactNode } from 'react'
import { assetUrl, type Crop, type Grid, type Layer, type Scene, type Token, type ViewRect } from '../../shared/types'
import { sceneBounds, type Camera } from './camera'
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
      className="grid"
      style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, opacity: grid.opacity }}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
    >
      <defs>{pattern}</defs>
      <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={`url(#${id})`} />
    </svg>
  )
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

interface Props {
  scene: Scene
  camera: Camera
  selectedId?: string | null
  /** DM only: outline of what the players see. */
  showViewFrame?: boolean
  /** Extra content in scene coordinates (e.g. the calibration rectangle). */
  children?: ReactNode
}

/** Renders a scene. Used by the DM editor and the player window, so both show the same thing. */
export function SceneView({ scene, camera, selectedId, showViewFrame, children }: Props) {
  const zoom = camera.zoom
  const layers = scene.layers.filter((l) => l.visible)
  const tokens = scene.tokens.filter((t) => t.visible)
  const bounds = scene.grid.visible ? sceneBounds(layers) : null
  const selectedLayer = layers.find((l) => l.id === selectedId)
  const selectedToken = tokens.find((t) => t.id === selectedId)
  const view = showViewFrame ? scene.view : null
  return (
    <div className="world" style={{ transform: `scale(${zoom}) translate(${-camera.x}px, ${-camera.y}px)` }}>
      {layers.map((l) => (
        <LayerMedia key={l.id} layer={l} />
      ))}
      {bounds && <GridOverlay grid={scene.grid} bounds={bounds} zoom={zoom} />}
      {tokens.map((t) => (
        <TokenView key={t.id} token={t} cellSize={scene.grid.size} />
      ))}
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
        <div className="selection" style={tokenBox(selectedToken, scene.grid.size)}>
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
