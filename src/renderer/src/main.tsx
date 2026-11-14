import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AppInfo } from '../../shared/types'
import { Library } from './Library'
import { PlayerView } from './Player'
import { Scenes } from './Scenes'
import './styles.css'

type Tab = 'scenes' | 'library'

function DmView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [tab, setTab] = useState<Tab>('scenes')
  useEffect(() => {
    void window.bellavellum.info().then(setInfo)
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
        <button onClick={() => void window.bellavellum.openPlayer()}>Spielerfenster</button>
      </header>
      {tab === 'scenes' ? <Scenes /> : <Library />}
    </main>
  )
}

const view = new URLSearchParams(location.search).get('view')
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<StrictMode>{view === 'player' ? <PlayerView /> : <DmView />}</StrictMode>)
}
