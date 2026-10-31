import { useMemo } from 'react'
import { ChevronDown, ChevronUp, Layers, Pencil } from 'lucide-react'
import { useStore } from '../state/store'

export function LayerDock() {
  const model = useStore((s) => s.model)
  const layer = useStore((s) => s.layer)
  const setLayer = useStore((s) => s.setLayer)
  const stepLayer = useStore((s) => s.stepLayer)
  const buildMode = useStore((s) => s.buildMode)
  const setBuildMode = useStore((s) => s.setBuildMode)
  const mode = useStore((s) => s.mode)

  const layers = model?.perLayer ?? []
  const top = layers.reduce((acc, l, i) => (l.items > 0 ? i : acc), 0)
  const count = layers.length ? top + 1 : 0
  const stat = layers[layer]
  const max = useMemo(() => Math.max(1, ...layers.map((l) => l.items)), [layers])

  return (
    <div className="layer-dock">
      <div className="layer-readout">
        <div className="layer-buttons">
          <button
            className="tool-btn"
            onClick={() => stepLayer(1)}
            disabled={layer >= count - 1}
            title="Layer up (→)"
          >
            <ChevronUp size={16} />
          </button>
          <button
            className="tool-btn"
            onClick={() => stepLayer(-1)}
            disabled={layer <= 0}
            title="Layer down (←)"
          >
            <ChevronDown size={16} />
          </button>
        </div>
        <div>
          <span className="layer-label">Layer</span>
          <div className="layer-number">
            <strong>{count ? layer + 1 : '—'}</strong>
            <span>/ {count || '—'}</span>
          </div>
        </div>
        <div className="layer-meta">
          <span>{stat?.items ?? 0} blocks</span>
          <span>{stat?.slabs ?? 0} ½ slabs</span>
        </div>
      </div>

      <div className="layer-track">
        <div className="layer-chart-wrap">
          <svg
            className="layer-chart"
            viewBox={`0 0 ${Math.max(count, 1)} 100`}
            preserveAspectRatio="none"
            onClick={(e) => {
              if (!count) return
              const rect = e.currentTarget.getBoundingClientRect()
              const t = (e.clientX - rect.left) / rect.width
              setLayer(Math.floor(t * count))
            }}
            role="presentation"
          >
            {layers.map((l, i) => {
              const h = (l.items / max) * 96
              const slabH = l.items ? (l.slabs / Math.max(1, l.items)) * h : 0
              const current = i === layer
              return (
                <g key={i}>
                  <rect
                    x={i}
                    y={100 - h}
                    width={0.86}
                    height={h}
                    fill={current ? '#5f7a33' : '#33402d'}
                  />
                  <rect
                    x={i}
                    y={100 - h}
                    width={0.86}
                    height={slabH}
                    fill={current ? '#d9ff6b' : '#6f8d38'}
                  />
                </g>
              )
            })}
          </svg>
          {count > 0 ? (
            <span
              className="layer-cursor"
              style={{ left: `${((Math.min(layer, count - 1) + 0.5) / count) * 100}%` }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="layer-slider-wrap">
          <input
            className="layer-range"
            type="range"
            min={0}
            max={Math.max(0, count - 1)}
            value={Math.min(layer, Math.max(0, count - 1))}
            onChange={(e) => setLayer(Number(e.target.value))}
            aria-label="Build layer"
          />
          {count > 0 ? (
            <span
              className="layer-knob"
              style={{ left: `${((Math.min(layer, count - 1) + 0.5) / count) * 100}%` }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="layer-scale">
          <span>1</span>
          <span>top</span>
        </div>
      </div>

      <div className="layer-actions">
        <button
          className={`dock-toggle ${buildMode ? 'active' : ''}`}
          onClick={() => setBuildMode(!buildMode)}
          title="Show only built layers and ghost what comes next"
        >
          {buildMode ? <Pencil size={14} /> : <Layers size={14} />}
          <span>{buildMode ? 'Build mode' : 'All layers'}</span>
        </button>
        <span className="dock-hint">{mode === '3d' ? 'click a bar to jump' : 'blueprint follows layer'}</span>
      </div>
    </div>
  )
}
