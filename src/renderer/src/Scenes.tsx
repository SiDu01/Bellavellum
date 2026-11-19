import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { DEFAULT_GRID, type Scene, type SceneSummary } from '../../shared/types'
import { Icon } from './controls'
import { useConfirm } from './Dialog'
import { SceneEditor } from './SceneEditor'

interface Props {
  active: boolean
  listOpen: boolean
  liveId: string | null
  setLiveId: (id: string | null) => void
  goLive: (id: string | null) => Promise<void>
}

export function Scenes({ active, listOpen, liveId, setLiveId, goLive }: Props) {
  const api = window.bellavellum.scenes
  const [list, setList] = useState<SceneSummary[]>([])
  const [current, setCurrent] = useState<Scene | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDialog, ask] = useConfirm()

  const addError = useCallback((msg: string) => setErrors((e) => [...e, msg]), [])

  const refresh = useCallback(async () => {
    const { scenes, broken } = await api.list()
    setList(scenes)
    if (broken.length > 0) addError(`Nicht lesbare Szenen-Dateien: ${broken.join(', ')}`)
  }, [api, addError])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function open(id: string) {
    try {
      setCurrent(await api.load(id))
    } catch (err) {
      addError(String(err))
    }
  }

  async function create() {
    const scene: Scene = {
      id: crypto.randomUUID(),
      name: 'Neue Szene',
      layers: [],
      grid: DEFAULT_GRID,
      tokens: [],
      fog: null,
      rooms: [],
      view: null
    }
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

  async function startLive(id: string) {
    try {
      await goLive(id)
    } catch (err) {
      addError(String(err))
    }
  }

  const onSaved = useCallback(
    (s: Scene) => setList((l) => l.map((x) => (x.id === s.id ? { id: s.id, name: s.name } : x))),
    []
  )

  return (
    <div className="scenes" hidden={!active}>
      <button className="fab" aria-label="Neue Szene" title="Neue Szene" onClick={() => void create()}>
        <Icon name="add" />
      </button>
      {listOpen && (
        <nav className="scene-list" aria-label="Szenen">
          <h2>Szenen</h2>
          <ul>
            {list.map((s) => (
              <li key={s.id} className={s.id === current?.id ? 'selected' : undefined}>
                <button className="scene-name" onClick={() => void open(s.id)}>
                  <span>{s.name || 'Ohne Namen'}</span>
                  {s.id === liveId && <span className="live-badge">LIVE</span>}
                </button>
                <button
                  className="icon-btn"
                  aria-label={`${s.name} in den Papierkorb`}
                  title="In den Papierkorb"
                  onClick={() =>
                    ask({ title: `Szene „${s.name}“ in den Papierkorb?`, action: 'In den Papierkorb', onConfirm: () => void remove(s.id) })
                  }
                >
                  <Icon name="delete" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {confirmDialog}
      <div className="scene-main">
        {errors.length > 0 && (
          <div className="errors" role="alert">
            <div>
              {errors.map((msg, i) => (
                <p key={i}>{msg}</p>
              ))}
            </div>
            <button className="icon-btn" aria-label="Meldungen schließen" onClick={() => setErrors([])}>
              <Icon name="close" />
            </button>
          </div>
        )}
        {current ? (
          <SceneEditor
            key={current.id}
            initial={current}
            active={active}
            isLive={current.id === liveId}
            onSaved={onSaved}
            onGoLive={() => void startLive(current.id)}
            onError={addError}
          />
        ) : (
          <p className="empty">Szene links auswählen oder „Neue Szene“ anlegen.</p>
        )}
      </div>
    </div>
  )
}
