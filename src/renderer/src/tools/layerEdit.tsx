import { useRef, useState, type ReactNode } from 'react'
import { assetUrl, type Layer } from '../../../shared/types'
import { Icon, ModeToggle } from '../controls'
import { toLayer } from '../frames'
import { cropBetween, evenCuts, splitLayer } from '../layerEdit'
import { cropToPng, isVideo } from '../thumbs'
import type { Point } from '../wand'
import type { Tool, ToolContext } from './tool'

/** Animated maps would lose their animation as a still image. */
export const isAnimated = (name: string) => isVideo(name) || /\.gif$/i.test(name)
/** Each part would be its own video element: new parts restart while the first keeps playing. */
export const VIDEO_SPLIT_HINT = 'Videos lassen sich nicht teilen: die Teile liefen nicht synchron'

/** Crop by dragging, cut by clicking, split into a grid, save the crop as an image. Non-destructive. */
export function useLayerEditTool(ctx: ToolContext): Tool & {
  toolbar: ReactNode
  split: (l: Layer, cols: number, rows: number) => void
  saveImage: (l: Layer) => Promise<void>
  info: string | null
} {
  const { selectedLayer } = ctx
  const [mode, setMode] = useState<'crop' | 'cut' | null>(null)
  const [axis, setAxis] = useState<'x' | 'y'>('x')
  const [info, setInfo] = useState<string | null>(null)
  const crop = useRef<{ id: string; start: Point } | null>(null)

  const replaceLayer = (id: string, parts: Layer[]) =>
    ctx.setScene((s) => ({ ...s, layers: s.layers.flatMap((l) => (l.id === id ? parts : [l])) }))

  const tool: Tool = {
    active: mode !== null && selectedLayer !== undefined,
    down(_e, p) {
      const l = selectedLayer
      if (!mode || !l) return false
      const a = toLayer(l, p)
      if (mode === 'crop') {
        if (!l.locked) crop.current = { id: l.id, start: a }
      } else if (!isVideo(l.name)) {
        const f = axis === 'x' ? a.x / l.width : a.y / l.height
        replaceLayer(l.id, splitLayer(l, axis === 'x' ? [f] : [], axis === 'y' ? [f] : []))
      }
      return true
    },
    move(_e, p) {
      const d = crop.current
      const l = d && ctx.scene.layers.find((x) => x.id === d.id)
      const c = d && l && cropBetween(l, d.start, toLayer(l, p))
      if (d && c) ctx.updateLayer(d.id, { crop: c })
    },
    up() {
      crop.current = null
    },
    cancel() {
      crop.current = null
    },
    reset: () => setMode(null),
    overlay: null
  }

  const pick = (m: 'crop' | 'cut') => {
    ctx.exclusive()
    setMode(mode === m ? null : m)
  }

  const toolbar = (
    <>
      <span className="divider" />
      <button
        aria-label="Zuschneiden"
        title={selectedLayer?.locked === false ? 'Zuschneiden: Rechteck über die Ebene ziehen' : 'Erst eine entsperrte Ebene wählen'}
        aria-pressed={mode === 'crop'}
        disabled={!selectedLayer || selectedLayer.locked}
        onClick={() => pick('crop')}
      >
        <Icon name="crop" />
      </button>
      <button
        aria-label="Teilen"
        title={
          !selectedLayer
            ? 'Erst eine Ebene wählen'
            : isVideo(selectedLayer.name)
              ? VIDEO_SPLIT_HINT
              : 'Teilen: auf die Ebene klicken, wo sie geteilt werden soll'
        }
        aria-pressed={mode === 'cut'}
        disabled={!selectedLayer || isVideo(selectedLayer.name)}
        onClick={() => pick('cut')}
      >
        <Icon name="content_cut" />
      </button>
      {mode === 'cut' && (
        <>
          <span className="divider" />
          <ModeToggle
            items={[
              { label: 'Senkrecht', icon: 'vertical_split', on: axis === 'x', pick: () => setAxis('x') },
              { label: 'Waagerecht', icon: 'horizontal_split', on: axis === 'y', pick: () => setAxis('y') }
            ]}
          />
        </>
      )}
    </>
  )

  function split(l: Layer, cols: number, rows: number) {
    replaceLayer(l.id, splitLayer(l, evenCuts(l.crop.left, 1 - l.crop.right, cols), evenCuts(l.crop.top, 1 - l.crop.bottom, rows)))
  }

  async function saveImage(l: Layer) {
    setInfo(`Speichere Ausschnitt von ${l.name}…`)
    try {
      const bytes = await cropToPng(assetUrl(l.kind, l.name), l)
      const stem = l.name.replace(/\.[^.]+$/, '')
      const { name, duplicate } = await window.bellavellum.library.save(l.kind, `${stem} Ausschnitt.png`, bytes)
      setInfo(duplicate ? `Schon in der Bibliothek: ${name}` : `In der Bibliothek gespeichert: ${name}`)
    } catch (err) {
      setInfo(`Speichern fehlgeschlagen: ${String(err)}`)
    }
  }

  return { ...tool, toolbar, split, saveImage, info }
}
