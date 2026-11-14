import type { CSSProperties } from 'react'
import { assetUrl, type Crop, type Layer, type Scene } from '../../shared/types'
import type { Camera } from './camera'
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

function LayerMedia({ layer }: { layer: Layer }) {
  const style: CSSProperties = {
    ...placement(layer),
    opacity: layer.opacity,
    mixBlendMode: layer.blend,
    clipPath: inset(layer.crop)
  }
  const url = assetUrl(layer.kind, layer.name)
  return isVideo(layer.name) ? (
    <video className="layer" data-layer-id={layer.id} style={style} src={url} autoPlay loop muted playsInline />
  ) : (
    <img className="layer" data-layer-id={layer.id} style={style} src={url} alt="" draggable={false} />
  )
}

interface Props {
  scene: Scene
  camera: Camera
  selectedId?: string | null
  /** DM only: outline of what the players see. */
  showViewFrame?: boolean
}

/** Renders a scene. Used by the DM editor and the player window, so both show the same thing. */
export function SceneView({ scene, camera, selectedId, showViewFrame }: Props) {
  const selected = scene.layers.find((l) => l.id === selectedId && l.visible)
  const view = showViewFrame ? scene.view : null
  return (
    <div className="world" style={{ transform: `scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)` }}>
      {scene.layers
        .filter((l) => l.visible)
        .map((l) => (
          <LayerMedia key={l.id} layer={l} />
        ))}
      {selected && (
        <div className="selection" style={placement(selected)}>
          <div
            style={{
              top: pct(selected.crop.top),
              right: pct(selected.crop.right),
              bottom: pct(selected.crop.bottom),
              left: pct(selected.crop.left),
              borderWidth: 2 / (camera.zoom * selected.scale)
            }}
          />
        </div>
      )}
      {view && (
        <div
          className="view-frame"
          style={{ left: view.x, top: view.y, width: view.width, height: view.height, borderWidth: 2 / camera.zoom }}
        />
      )}
    </div>
  )
}
