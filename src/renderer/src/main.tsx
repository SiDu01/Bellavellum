import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AppInfo } from '../../shared/types'
import { Library } from './Library'
import './styles.css'

function DmView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.bellavellum.info().then(setInfo)
  }, [])

  return (
    <main className="dm">
      <header>
        <h1>Bellavellum</h1>
        {info && (
          <span className="info" title={info.dataDir}>
            {info.dataDir} · {info.displayCount} {info.displayCount === 1 ? 'Display' : 'Displays'}
          </span>
        )}
      </header>
      <Library />
    </main>
  )
}

function PlayerView() {
  return <main className="player">Bellavellum</main>
}

const view = new URLSearchParams(location.search).get('view')
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<StrictMode>{view === 'player' ? <PlayerView /> : <DmView />}</StrictMode>)
}
