interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, unit, onChange }: SliderProps) {
  return (
    <label className="prop">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {Math.round(value)}
        {unit}
      </output>
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
