import type { CSSProperties } from 'react'

/** Material Symbols ligature, e.g. "delete". Decorative: give the parent button an aria-label. */
export function Icon({ name }: { name: string }) {
  return (
    <span className="icon" aria-hidden="true">
      {name}
    </span>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  unit: string
  /** Replaces the rounded value + unit. */
  display?: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, unit, display, onChange }: SliderProps) {
  return (
    <label className="prop">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        // Drives the filled part of the track in styles.css.
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{display ?? `${Math.round(value)}${unit}`}</output>
    </label>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  step: number
  onChange: (value: number) => void
}

export function NumberField({ label, value, min, step, onChange }: NumberFieldProps) {
  return (
    <label className="prop">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(v) && (min === undefined || v >= min)) onChange(v)
        }}
      />
    </label>
  )
}

interface ModeItem {
  label: string
  icon: string
  on: boolean
  pick: () => void
}

/** The add/remove (or reveal/hide) switch at the end of the stage toolbar. */
export function ModeToggle({ items, disabled }: { items: ModeItem[]; disabled?: boolean }) {
  return (
    <div className="segmented" role="group" aria-label="Modus">
      {items.map(({ label, icon, on, pick }) => (
        <button key={label} aria-pressed={on} disabled={disabled} onClick={pick}>
          <Icon name={icon} />
          {label}
        </button>
      ))}
    </div>
  )
}
