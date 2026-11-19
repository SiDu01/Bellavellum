import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Room, ViewRect } from '../../../shared/types'
import { Icon, ModeToggle } from '../controls'
import { normalizeRect } from '../grid'
import { ROOM_SHAPES, RoomPanel, type RoomTool } from '../RoomPanel'
import { addSquare, addSquares, cellAt, cellsInRect, eraseAt, eraseRect, gridBlock, ROOM_COLORS } from '../rooms'
import { gridMapPng, squareColors } from '../thumbs'
import { cellsInPolygon, insidePolygon, pickFloor, type Point } from '../wand'
import type { FogControl } from './fog'
import type { Tool, ToolContext } from './tool'

type Drag =
  | { shape: 'brush'; roomId: string; erase: boolean; last: Point }
  | { shape: 'rect'; roomId: string; erase: boolean; start: Point }
  | { shape: 'wand'; roomId: string; erase: boolean; points: Point[] }

/** Cells added around each room Gemini suggests; its edges tend to be a cell short. */
const GROW = 1

/** Rooms painted on the scene grid, for one-click fog reveal. */
export function useRoomTool(
  ctx: ToolContext,
  fog: Pick<FogControl, 'fog' | 'fogRoom'>
): Tool & { toolbar: ReactNode; panel: ReactNode; roomsView: { activeId: string | null } | undefined } {
  const { scene, setScene } = ctx
  const [painting, setPainting] = useState<string | null>(null)
  const [showRooms, setShowRooms] = useState(true)
  const [roomTool, setRoomTool] = useState<RoomTool>({ shape: 'brush', erase: false })
  const [tolerance, setTolerance] = useState(50)
  const [wandInfo, setWandInfo] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<ViewRect | null>(null)
  const [lasso, setLasso] = useState<Point[] | null>(null)
  const drag = useRef<Drag | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestInfo, setSuggestInfo] = useState<string | null>(null)

  useEffect(() => void window.bellavellum.gemini.hasKey().then(setHasKey), [])

  /** Sends the map with a numbered grid to Gemini and adds its rooms as new rooms. */
  async function suggestRooms() {
    setSuggesting(true)
    setSuggestInfo('Gemini wertet die Map aus, das kann einige Minuten dauern…')
    try {
      const grid = scene.grid
      const { image, cols, rows, col0, row0 } = await gridMapPng(scene.layers, grid)
      const suggested = await window.bellavellum.gemini.rooms(image, cols, rows)
      setScene((sc) => {
        const added = suggested.map((r, i): Room => {
          const n = sc.rooms.length + i
          // Every rectangle grows by GROW cells on each side: rooms reveal fog, and too much beats too little.
          const squares = r.rects.flatMap((q) =>
            gridBlock(grid, col0 + q.col - GROW, row0 + q.row - GROW, q.w + 2 * GROW, q.h + 2 * GROW)
          )
          return addSquares({ id: crypto.randomUUID(), name: r.name, color: ROOM_COLORS[n % ROOM_COLORS.length], squares: [] }, squares)
        })
        return { ...sc, rooms: [...sc.rooms, ...added] }
      })
      setSuggestInfo(`${suggested.length} Räume vorgeschlagen. Ränder bitte mit dem Pinsel prüfen.`)
    } catch (err) {
      setSuggestInfo(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    } finally {
      setSuggesting(false)
    }
  }

  function startPainting(id: string | null) {
    if (id) ctx.exclusive()
    setPainting(id)
  }

  function addRoom() {
    const n = scene.rooms.length
    const room: Room = { id: crypto.randomUUID(), name: `Raum ${n + 1}`, color: ROOM_COLORS[n % ROOM_COLORS.length], squares: [] }
    setScene((s) => ({ ...s, rooms: [...s.rooms, room] }))
    startPainting(room.id)
  }

  /** Paints (or erases) every cell along the stroke from `from` to `to`: fast drags skip cells otherwise. */
  function paint(id: string, erase: boolean, from: Point, to: Point) {
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
    if (erase) {
      setScene((s) => ({
        ...s,
        rooms: s.rooms.map((r) =>
          r.id !== id ? r : { ...r, squares: r.squares.filter(([x, y, q]) => !insidePolygon(points, x + q / 2, y + q / 2)) }
        )
      }))
      return
    }
    const cells = cellsInPolygon(scene.grid, points)
    if (cells.length === 0) return setWandInfo('Umriss zu klein: kein Feldmittelpunkt liegt darin.')
    try {
      const picked = pickFloor(cells, await squareColors(scene.layers, cells), tolerance)
      setScene((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? addSquares(r, picked) : r)) }))
      setWandInfo(`${picked.length} von ${cells.length} Feldern im Umriss übernommen.`)
    } catch (err) {
      setWandInfo(`Zauberstab fehlgeschlagen: ${String(err)}`)
    }
  }

  const tool: Tool = {
    active: painting !== null,
    down(e, p) {
      if (!painting) return false
      const erase = roomTool.erase !== e.altKey
      if (roomTool.shape === 'rect') {
        drag.current = { shape: 'rect', roomId: painting, erase, start: p }
        setMarquee({ x: p.x, y: p.y, width: 0, height: 0 })
      } else if (roomTool.shape === 'wand') {
        drag.current = { shape: 'wand', roomId: painting, erase, points: [p] }
        setLasso([p])
      } else {
        paint(painting, erase, p, p)
        drag.current = { shape: 'brush', roomId: painting, erase, last: p }
      }
      return true
    },
    move(_e, p) {
      const d = drag.current
      if (d?.shape === 'rect') setMarquee(normalizeRect(d.start.x, d.start.y, p.x, p.y))
      else if (d?.shape === 'wand') {
        d.points.push(p)
        setLasso([...d.points])
      } else if (d?.shape === 'brush') {
        paint(d.roomId, d.erase, d.last, p)
        d.last = p
      }
    },
    // The rectangle comes from the release point: the marquee state may not include the last move yet.
    up(_e, p) {
      const d = drag.current
      drag.current = null
      if (d?.shape === 'rect') {
        const rect = normalizeRect(d.start.x, d.start.y, p.x, p.y)
        setScene((s) => ({
          ...s,
          rooms: s.rooms.map((r) => (r.id !== d.roomId ? r : d.erase ? eraseRect(r, rect) : addSquares(r, cellsInRect(s.grid, rect))))
        }))
        setMarquee(null)
      } else if (d?.shape === 'wand') {
        setLasso(null)
        void applyLasso(d.roomId, d.erase, d.points)
      }
    },
    cancel() {
      drag.current = null
      setMarquee(null)
      setLasso(null)
    },
    reset: () => setPainting(null),
    overlay: (
      <>
        {lasso && (
          <svg className="lasso">
            <polyline
              points={lasso.map((q) => `${q.x},${q.y}`).join(' ')}
              fill="rgb(201 164 92 / 0.15)"
              stroke="var(--primary)"
              strokeWidth={2 / ctx.zoom}
            />
          </svg>
        )}
        {marquee && (
          <div
            className="marquee"
            style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height, borderWidth: 2 / ctx.zoom }}
          />
        )}
      </>
    )
  }

  const toolbar = (
    <>
      <select
        className="room-chip"
        aria-label="Raum bearbeiten"
        value={painting ?? ''}
        disabled={scene.rooms.length === 0}
        onChange={(e) => startPainting(e.target.value || null)}
      >
        <option value="">{scene.rooms.length === 0 ? 'Kein Raum' : 'Raum wählen…'}</option>
        {scene.rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <span className="divider" />
      {ROOM_SHAPES.map(({ label, icon, shape }) => (
        <button
          key={shape}
          aria-label={label}
          title={painting ? label : 'Erst einen Raum wählen'}
          aria-pressed={painting !== null && roomTool.shape === shape}
          disabled={!painting}
          onClick={() => setRoomTool((t) => ({ ...t, shape }))}
        >
          <Icon name={icon} />
        </button>
      ))}
      <span className="divider" />
      <ModeToggle
        items={[
          { label: 'Hinzufügen', icon: 'add', on: !roomTool.erase, pick: () => setRoomTool((t) => ({ ...t, erase: false })) },
          { label: 'Entfernen', icon: 'remove', on: roomTool.erase, pick: () => setRoomTool((t) => ({ ...t, erase: true })) }
        ]}
      />
    </>
  )

  const panel = (
    <RoomPanel
      rooms={scene.rooms}
      paintingId={painting}
      tool={roomTool}
      tolerance={tolerance}
      onTolerance={setTolerance}
      wandInfo={wandInfo}
      fogActive={fog.fog !== null}
      showRooms={showRooms}
      onShowRooms={setShowRooms}
      onAdd={addRoom}
      onPaint={startPainting}
      onRename={(id, name) => setScene((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, name } : r)) }))}
      onRemove={(id) => {
        setScene((s) => ({ ...s, rooms: s.rooms.filter((r) => r.id !== id) }))
        if (painting === id) setPainting(null)
      }}
      onFog={fog.fogRoom}
      hasKey={hasKey}
      suggesting={suggesting}
      suggestInfo={suggestInfo}
      onSuggest={() => void suggestRooms()}
    />
  )

  return { ...tool, toolbar, panel, roomsView: showRooms || painting ? { activeId: painting } : undefined }
}
