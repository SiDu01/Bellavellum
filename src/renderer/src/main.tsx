import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import 'material-symbols/rounded.css'
import type { AppInfo, DisplayInfo } from '../../shared/types'
import { Icon } from './controls'
import { DisplayPicker } from './DisplayPicker'
import { Library } from './Library'
import { PlayerView } from './Player'
import { Scenes } from './Scenes'
import { Settings } from './Settings'
import './styles.css'

type Tab = 'scenes' | 'library' | 'settings'

function DmView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [tab, setTab] = useState<Tab>('scenes')
  const [listOpen, setListOpen] = useState(true)
  const [displays, setDisplays] = useState<DisplayInfo[] | null>(null)
  const [liveId, setLiveId] = useState<string | null>(null)
  const goLive = async (id: string | null) => setLiveId(await window.bellavellum.live.set(id))
  const pickDisplay = () => void window.bellavellum.displays().then(setDisplays)
  useEffect(() => {
    void window.bellavellum.info().then(setInfo)
    void window.bellavellum.live.id().then(setLiveId)
    // Main opened the player on the remembered display if it found it; otherwise ask, if there is a choice.
    void window.bellavellum.displays().then((list) => {
      if (list.length > 1 && !list.some((d) => d.player)) setDisplays(list)
    })
  }, [])

  return (
    <main className="dm">
      <nav className="rail" aria-label="Hauptnavigation">
        <button
          className="icon-btn"
          aria-label="Szenenliste"
          title={listOpen ? 'Szenenliste einklappen' : 'Szenenliste ausklappen'}
          aria-expanded={listOpen}
          disabled={tab !== 'scenes'}
          onClick={() => setListOpen((o) => !o)}
        >
          <Icon name="menu" />
        </button>
        <div className="fab-slot" />
        <div role="tablist" aria-label="Bereich" aria-orientation="vertical">
          <button role="tab" className="rail-item" aria-selected={tab === 'scenes'} onClick={() => setTab('scenes')}>
            <Icon name="map" />
            Szenen
          </button>
          <button role="tab" className="rail-item" aria-selected={tab === 'library'} onClick={() => setTab('library')}>
            <Icon name="photo_library" />
            Bibliothek
          </button>
        </div>
        <span className="spacer" />
        {/* In the rail so the blackout is one click away in every view. */}
        {liveId && (
          <button className="rail-item blackout" onClick={() => void goLive(null)} title="Spielerbildschirm wird schwarz">
            <Icon name="visibility_off" />
            Ausblenden
          </button>
        )}
        <button className="rail-item" title="Spielerbildschirm wählen" onClick={pickDisplay}>
          <Icon name="connected_tv" />
          Spieler
        </button>
        <button className="rail-item" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}>
          <Icon name="settings" />
          Einstellungen
        </button>
      </nav>
      {/* Scenes and Library stay mounted: switching views must not close the open scene. */}
      <Scenes active={tab === 'scenes'} listOpen={listOpen} liveId={liveId} setLiveId={setLiveId} goLive={goLive} />
      <Library active={tab === 'library'} info={info} />
      {tab === 'settings' && <Settings />}
      {displays && <DisplayPicker displays={displays} onClose={() => setDisplays(null)} />}
    </main>
  )
}

const view = new URLSearchParams(location.search).get('view')
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<StrictMode>{view === 'player' ? <PlayerView /> : <DmView />}</StrictMode>)
}
