import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelText, parseRooms, suggestRooms } from './gemini.ts'

test('reads the text of the last model_output step', () => {
  const body = {
    status: 'completed',
    steps: [
      { type: 'user_input', content: [{ type: 'text', text: 'prompt' }] },
      { type: 'model_output', content: [{ type: 'text', text: '[{"name"' }, { type: 'text', text: ':"A","rects":[]}]' }] }
    ]
  }
  assert.equal(modelText(body), '[{"name":"A","rects":[]}]')
  assert.throws(() => modelText({ steps: [] }))
})

test('keeps valid rooms, clips rectangles to the grid, drops junk', () => {
  const text = JSON.stringify([
    { name: ' Halle ', rects: [{ col: 8, row: 0, w: 5, h: 2 }, { col: 1, row: 1, w: 1.5, h: 1 }] },
    { name: 'Draußen', rects: [{ col: 20, row: 0, w: 2, h: 2 }] },
    { rects: [{ col: -1, row: -1, w: 2, h: 2 }] },
    'junk'
  ])
  assert.deepEqual(parseRooms(text, 10, 5), [
    { name: 'Halle', rects: [{ col: 8, row: 0, w: 2, h: 2 }] },
    { name: 'Raum 2', rects: [{ col: 0, row: 0, w: 1, h: 1 }] }
  ])
  assert.throws(() => parseRooms('not json', 10, 5))
  assert.throws(() => parseRooms('{}', 10, 5))
})

test('polls a background interaction until it completes', async (t) => {
  const answer = [{ name: 'Halle', rects: [{ col: 0, row: 0, w: 2, h: 1 }] }]
  const replies = [
    { id: 'int_1', status: 'in_progress' },
    { id: 'int_1', status: 'completed', steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(answer) }] }] }
  ]
  const urls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url)
    return new Response(JSON.stringify(replies.shift()), { status: 200 })
  })
  assert.deepEqual(await suggestRooms('key', new Uint8Array([1]), 5, 5), answer)
  assert.match(urls[1] ?? '', /\/interactions\/int_1$/)
})

test('reports a failed interaction', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ id: 'x', status: 'failed' }), { status: 200 }))
  await assert.rejects(suggestRooms('key', new Uint8Array([1]), 5, 5), /failed/)
})
