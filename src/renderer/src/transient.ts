import { useCallback, useRef, useState } from 'react'
import type { Transient } from '../../shared/types'
import type { Ping } from './SceneView'

const PING_MS = 2000

/** Pings, pointer and measuring as the player window shows them. */
export function useTransient() {
  const [pings, setPings] = useState<Ping[]>([])
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [measure, setMeasure] = useState<Extract<Transient, { type: 'measure' }> | null>(null)
  const next = useRef(0)
  const apply = useCallback((t: Transient) => {
    if (t.type === 'ping') {
      const id = next.current++
      setPings((ps) => [...ps, { id, x: t.x, y: t.y }])
      setTimeout(() => setPings((ps) => ps.filter((p) => p.id !== id)), PING_MS)
    } else if (t.type === 'pointer') setPointer({ x: t.x, y: t.y })
    else if (t.type === 'pointer-end') setPointer(null)
    else setMeasure(t.area ? t : null)
  }, [])
  return { pings, pointer, measure, apply }
}
