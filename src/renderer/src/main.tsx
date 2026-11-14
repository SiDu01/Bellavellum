import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AppInfo } from '../../shared/types'
import './styles.css'

function DmView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.bellavellum.info().then(setInfo)
  }, [])

  return (
    <main className="dm">
      <h1>Bellavellum</h1>
      {info && (
        <dl>
          <dt>Datenordner</dt>
          <dd>{info.dataDir}</dd>
          <dt>Displays</dt>
          <dd>{info.displayCount}</dd>
        </dl>
      )}
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
