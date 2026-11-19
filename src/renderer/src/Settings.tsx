import { useEffect, useState } from 'react'

export function Settings() {
  const gemini = window.bellavellum.gemini
  const [hasKey, setHasKey] = useState(false)
  const [key, setKey] = useState('')
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => void gemini.hasKey().then(setHasKey), [gemini])

  async function save(value: string) {
    try {
      await gemini.setKey(value)
      const saved = await gemini.hasKey()
      setHasKey(saved)
      setKey('')
      setInfo(saved ? 'Key gespeichert.' : 'Key entfernt.')
    } catch (err) {
      setInfo(`Speichern fehlgeschlagen: ${String(err)}`)
    }
  }

  return (
    <section className="library settings">
      <div className="library-head">
        <h1>Einstellungen</h1>
      </div>
      <h2 className="settings-section">Gemini</h2>
      <p className="settings-intro">
        Schlägt im Räume-Panel Räume für die Map vor. Die sichtbare Map wird dafür an Google geschickt.
      </p>
      <div className="settings-row">
        <div>
          <div>API-Key</div>
          <div className="supporting">{hasKey ? 'Gespeichert' : 'Nicht hinterlegt'}</div>
        </div>
        {hasKey && (
          <button className="outlined" onClick={() => void save('')}>
            Entfernen
          </button>
        )}
      </div>
      <form
        className="settings-field"
        onSubmit={(e) => {
          e.preventDefault()
          void save(key)
        }}
      >
        <div>
          <label className="text-field">
            {hasKey ? 'Neuer API-Key' : 'API-Key'}
            <input type="password" aria-describedby="gemini-key-help" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <p id="gemini-key-help" className="supporting">
            Von aistudio.google.com. Liegt unverschlüsselt im Datenordner auf dem Stick.
          </p>
        </div>
        <button type="submit" className="primary" disabled={!key.trim()}>
          Speichern
        </button>
      </form>
      {info && (
        <p className="supporting" role="status">
          {info}
        </p>
      )}
    </section>
  )
}
