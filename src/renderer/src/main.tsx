import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AppInfo, DisplayInfo } from '../../shared/types'
import { DisplayPicker } from './DisplayPicker'
import { Library } from './Library'
import { PlayerView } from './Player'
import { Scenes } from './Scenes'
import './styles.css'

type Tab = 'scenes' | 'library'

function DmView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [tab, setTab] = useState<Tab>('scenes')
  const [displays, setDisplays] = useState<DisplayInfo[] | null>(null)
  const pickDisplay = () => void window.bellavellum.displays().then(setDisplays)
  useEffect(() => {
    void window.bellavellum.info().then(setInfo)
    // Main opened the player on the remembered display if it found it; otherwise ask, if there is a choice.
    void window.bellavellum.displays().then((list) => {
      if (list.length > 1 && !list.some((d) => d.player)) setDisplays(list)
    })
  }, [])

  return (
    <main className="dm">
      <header>
        <h1>Bellavellum</h1>
        <div role="tablist" aria-label="Bereich">
          <button role="tab" aria-selected={tab === 'scenes'} onClick={() => setTab('scenes')}>
            Szenen
          </button>
          <button role="tab" aria-selected={tab === 'library'} onClick={() => setTab('library')}>
            Bibliothek
          </button>
        </div>
        {info && (
          <span className="info" title={info.dataDir}>
            {info.dataDir} · {info.displayCount} {info.displayCount === 1 ? 'Display' : 'Displays'}
          </span>
        )}
        <button onClick={pickDisplay}>Spielerbildschirm…</button>
      </header>
      {tab === 'scenes' ? <Scenes /> : <Library />}
      {displays && <DisplayPicker displays={displays} onClose={() => setDisplays(null)} />}
    </main>
  )
}

const view = new URLSearchParams(location.search).get('view')
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<StrictMode>{view === 'player' ? <PlayerView /> : <DmView />}</StrictMode>)
}
