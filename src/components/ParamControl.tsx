import type { NumberParam, ParamValue } from '../core/types'

function fmt(n: number, integer?: boolean): string {
  if (integer) return String(Math.round(n))
  return Number(n.toFixed(2)).toString()
}

export function ParamControl({
  def,
  value,
  onChange,
}: {
  def: NumberParam
  value: ParamValue
  onChange: (v: number) => void
}) {
  const v = typeof value === 'number' ? value : def.default
  const pct = ((v - def.min) / Math.max(0.0001, def.max - def.min)) * 100
  const presets = [16, 32, 48, 64, 96, 128].filter(
    (p) => p >= def.min && p <= def.max && (def.max - def.min > 40),
  )

  return (
    <div className="param">
      <div className="param-head">
        <label htmlFor={`p-${def.key}`}>{def.label}</label>
        <div className="param-value">
          <input
            id={`p-${def.key}`}
            type="number"
            value={def.integer ? Math.round(v) : Number(v.toFixed(2))}
            min={def.min}
            max={def.max}
            step={def.step}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (Number.isFinite(next)) onChange(Math.max(def.min, Math.min(def.max, next)))
            }}
          />
          <span>{def.unit ?? ''}</span>
        </div>
      </div>
      <input
        className="range"
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={v}
        style={{ ['--fill' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {presets.length > 0 ? (
        <div className="preset-row">
          {presets.map((p) => (
            <button
              key={p}
              className={Math.round(v) === p ? 'preset active' : 'preset'}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}
      {def.hint ? <p className="param-hint">{def.hint}</p> : null}
    </div>
  )
}

export function formatParamValue(def: NumberParam, value: ParamValue): string {
  return `${fmt(typeof value === 'number' ? value : def.default, def.integer)}${def.unit ? ` ${def.unit}` : ''}`
}
