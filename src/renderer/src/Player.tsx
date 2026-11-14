import { useEffect, useRef, useState } from 'react'
import type { Scene } from '../../shared/types'
import { fitCamera, sceneBounds } from './camera'
import { SceneView } from './SceneView'
import { useSize } from './useSize'

export function PlayerView() {
  const [scene, setScene] = useState<Scene | null>(null)
  const root = useRef<HTMLElement>(null)
  const size = useSize(root)

  useEffect(() => {
    const unsubscribe = window.bellavellum.live.onScene(setScene)
    void window.bellavellum.live.get().then(setScene)
    return unsubscribe
  }, [])

  const rect = scene ? (scene.view ?? sceneBounds(scene.layers)) : null
  return (
    <main ref={root} className="player">
      {scene && rect && size.width > 0 && <SceneView scene={scene} camera={fitCamera(rect, size.width, size.height)} />}
    </main>
  )
}
