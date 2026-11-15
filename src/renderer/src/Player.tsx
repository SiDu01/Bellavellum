import { useEffect, useRef, useState } from 'react'
import type { Scene } from '../../shared/types'
import { fitCamera, sceneBounds } from './camera'
import { SceneView } from './SceneView'
import { useSize } from './useSize'

/** What the players see. Also the DM's preview, hence the class. */
export function PlayerView({ className = 'player' }: { className?: string }) {
  const [scene, setScene] = useState<Scene | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const size = useSize(root)

  useEffect(() => {
    const unsubscribe = window.bellavellum.live.onScene(setScene)
    void window.bellavellum.live.get().then(setScene)
    return unsubscribe
  }, [])

  const rect = scene ? (scene.view ?? sceneBounds(scene.layers)) : null
  const camera = rect && size.width > 0 ? fitCamera(rect, size.width, size.height) : null
  return (
    <div ref={root} className={className}>
      {scene && rect && camera && (
        // Black bars instead of extra map when the display's aspect ratio differs from the view.
        <div className="player-frame" style={{ width: rect.width * camera.zoom, height: rect.height * camera.zoom }}>
          <SceneView scene={scene} camera={camera} fog={{ version: scene.fog?.revision ?? 0, dm: false }} />
        </div>
      )}
    </div>
  )
}
