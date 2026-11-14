import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Scene, SceneSummary } from '../../shared/types'
import { SceneEditor } from './SceneEditor'

export function Scenes() {
  const api = window.bellavellum.scenes
  const [list, setList] = useState<SceneSummary[]>([])
  const [current, setCurrent] = useState<Scene | null>(null)
  const [liveId, setLiveId] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const addError = useCallback((msg: string) => setErrors((e) => [...e, msg]), [])

  const refresh = useCallback(async () => {
    const { scenes, broken } = await api.list()
    setList(scenes)
    if (broken.length > 0) addError(`Nicht lesbare Szenen-Dateien: ${broken.join(', ')}`)
  }, [api, addError])

  useEffect(() => {
    void refresh()
    void window.bellavellum.live.id().then(setLiveId)
  }, [refresh])

  async function open(id: string) {
    try {
      setCurrent(await api.load(id))
    } catch (err) {
      addError(String(err))
    }
  }

  async function create() {
    const scene: Scene = { id: crypto.randomUUID(), name: 'Neue Szene', layers: [], view: null }
    try {
      await api.save(scene)
      await refresh()
      setCurrent(scene)
    } catch (err) {
      addError(`Anlegen fehlgeschlagen: ${String(err)}`)
    }
  }

  async function remove(id: string) {
    // Unmount the editor first so its pending save is queued before the delete.
    if (current?.id === id) flushSync(() => setCurrent(null))
    try {
      await api.remove(id)
      if (liveId === id) setLiveId(null)
    } catch (err) {
      addError(`Löschen fehlgeschlagen: ${String(err)}`)
    }
    await refresh()
  }

  async function goLive(id: string | null) {
    try {
      setLiveId(await window.bellavellum.live.set(id))
    } catch (err) {
      addError(String(err))
    }
  }

  const onSaved = useCallback(
    (s: Scene) => setList((l) => l.map((x) => (x.id === s.id ? { id: s.id, name: s.name } : x))),
    []
  )

  return (
    <div className="scenes">
      <nav className="scene-list" aria-label="Szenen">
        <button className="primary" onClick={() => void create()}>
          Neue Szene
        </button>
        <ul>
          {list.map((s) => (
            <li key={s.id} className={s.id === current?.id ? 'selected' : undefined}>
              <button className="scene-name" onClick={() => void open(s.id)}>
                {s.id === liveId && <span className="live-dot" aria-label="live" />}
                {s.name || 'Ohne Namen'}
              </button>
              <button aria-label={`${s.name} in den Papierkorb`} onClick={() => void remove(s.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        {liveId && (
          <button onClick={() => void goLive(null)} title="Spielerbildschirm wird schwarz">
            Spieler ausblenden
          </button>
        )}
      </nav>

      <div className="scene-main">
        {errors.length > 0 && (
          <div className="errors" role="alert">
            {errors.map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
            <button onClick={() => setErrors([])}>Schließen</button>
          </div>
        )}
        {current ? (
          <SceneEditor
            key={current.id}
            initial={current}
            isLive={current.id === liveId}
            onSaved={onSaved}
            onGoLive={() => void goLive(current.id)}
            onError={addError}
          />
        ) : (
          <p className="empty">Szene links auswählen oder „Neue Szene“ anlegen.</p>
        )}
      </div>
    </div>
  )
}
