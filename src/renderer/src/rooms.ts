import type { Grid, Room, ViewRect } from '../../shared/types'

export const ROOM_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45']

/** The grid cell under (x, y) as a square. Hex grids use squares of the same size as an approximation. */
export function cellAt(grid: Grid, x: number, y: number): [number, number, number] {
  const s = grid.size
  return [grid.offsetX + Math.floor((x - grid.offsetX) / s) * s, grid.offsetY + Math.floor((y - grid.offsetY) / s) * s, s]
}

const contains = ([sx, sy, s]: [number, number, number], x: number, y: number) =>
  x >= sx && x < sx + s && y >= sy && y < sy + s

const same = (a: [number, number, number], b: [number, number, number]) =>
  Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 0.01

export function addSquare(room: Room, square: [number, number, number]): Room {
  return room.squares.some((q) => same(q, square)) ? room : { ...room, squares: [...room.squares, square] }
}

const key = ([x, y, s]: [number, number, number]) => `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(s * 100)}`

/** Adds many squares at once; a Set keeps big rectangles linear instead of quadratic. */
export function addSquares(room: Room, squares: [number, number, number][]): Room {
  const seen = new Set(room.squares.map(key))
  const added = squares.filter((q) => !seen.has(key(q)) && seen.add(key(q)))
  return added.length === 0 ? room : { ...room, squares: [...room.squares, ...added] }
}

/** Grid cells whose center lies inside the rectangle. */
export function cellsInRect(grid: Grid, rect: ViewRect): [number, number, number][] {
  const [x0, y0, s] = cellAt(grid, rect.x, rect.y)
  const cells: [number, number, number][] = []
  for (let y = y0; y + s / 2 <= rect.y + rect.height; y += s) {
    for (let x = x0; x + s / 2 <= rect.x + rect.width; x += s) {
      if (x + s / 2 >= rect.x && y + s / 2 >= rect.y) cells.push([x, y, s])
    }
  }
  return cells
}

/** Removes every square whose center lies inside the rectangle, whatever grid it was painted on. */
export function eraseRect(room: Room, rect: ViewRect): Room {
  const inside = ([x, y, s]: [number, number, number]) =>
    x + s / 2 >= rect.x && x + s / 2 <= rect.x + rect.width && y + s / 2 >= rect.y && y + s / 2 <= rect.y + rect.height
  const squares = room.squares.filter((q) => !inside(q))
  return squares.length === room.squares.length ? room : { ...room, squares }
}

/** Removes every square under the point, whatever grid it was painted on. */
export function eraseAt(room: Room, x: number, y: number): Room {
  const squares = room.squares.filter((q) => !contains(q, x, y))
  return squares.length === room.squares.length ? room : { ...room, squares }
}

/** Topmost (last) room with a square under the point. */
export function roomAt(rooms: Room[], x: number, y: number): Room | null {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i]
    if (room?.squares.some((q) => contains(q, x, y))) return room
  }
  return null
}

export function roomBounds(room: Room): ViewRect | null {
  if (room.squares.length === 0) return null
  const minX = Math.min(...room.squares.map((q) => q[0]))
  const minY = Math.min(...room.squares.map((q) => q[1]))
  const maxX = Math.max(...room.squares.map((q) => q[0] + q[2]))
  const maxY = Math.max(...room.squares.map((q) => q[1] + q[2]))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
