import { Download, Paintbrush, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { getShape } from '../core/shapes'
import { useStore } from '../state/store'
import type { ParamDef, ParamValue } from '../core/types'
import { ParamControl } from './ParamControl'
import { MaterialPicker } from './MaterialPicker'
import { TEXTURE_VERSION } from '../core/versions'
import { ExportPanel } from './ExportPanel'

const GROUP_ORDER = ['Dimensions', 'Style', 'Details', 'Generation']

export function Inspector() {
  const open = useStore((s) => s.inspectorOpen)
  const setOpen = useStore((s) => s.setInspectorOpen)
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const shapeId = useStore((s) => s.shapeId)
  const params = useStore((s) => s.params)
  const setParam = useStore((s) => s.setParam)
  const detail = useStore((s) => s.detail)
  const setDetail = useStore((s) => s.setDetail)
  const model = useStore((s) => s.model)
  const textures = useStore((s) => s.textures)
  const textureStatus = useStore((s) => s.textureStatus)
  const textureLoaded = useStore((s) => s.textureLoaded)
  const textureTotal = useStore((s) => s.textureTotal)
  const setTextures = useStore((s) => s.setTextures)
  const status = useStore((s) => s.status)
  const error = useStore((s) => s.error)
  const shape = getShape(shapeId)

  const groups = GROUP_ORDER.map((group) => ({
    group,
    defs: shape.params.filter(
      (p) =>
        (p.group ?? 'Dimensions') === group &&
        (!p.showIf || params[p.showIf.key] === p.showIf.equals),
    ),
  })).filter((g) => g.defs.length > 0)

  return (
    <aside className={`inspector ${open ? 'open' : ''}`} aria-label="Shape controls">
      <div className="inspector-head">
        <div>
          <p className="eyebrow">Design</p>
          <h2>{shape.name}</h2>
        </div>
        <button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Close controls">
          <X size={18} />
        </button>
      </div>

      <div className="inspector-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'shape'} className={tab === 'shape' ? 'active' : ''} onClick={() => setTab('shape')}>
          <SlidersHorizontal size={15} /> Shape
        </button>
        <button role="tab" aria-selected={tab === 'blocks'} className={tab === 'blocks' ? 'active' : ''} onClick={() => setTab('blocks')}>
          <Paintbrush size={15} /> Blocks
        </button>
        <button role="tab" aria-selected={tab === 'export'} className={tab === 'export' ? 'active' : ''} onClick={() => setTab('export')}>
          <Download size={15} /> Export
        </button>
      </div>

      <div className="inspector-body">
        {tab === 'shape' ? (
          <>
            <p className="shape-description">{shape.description}</p>

            <div className={`slab-card ${detail ? 'on' : ''}`}>
              <div className="slab-card-icon">
                <span className="half-cube"><i /></span>
              </div>
              <div className="slab-card-copy">
                <strong>½-block detail</strong>
                <p>
                  Sample curved edges twice as finely and place bottom/top slabs. Smoother domes,
                  spheres and arches — exported with the correct slab state.
                </p>
              </div>
              <button
                className={`switch ${detail ? 'on' : ''}`}
                onClick={() => setDetail(!detail)}
                aria-pressed={detail}
                aria-label="Toggle half-slab detail"
              >
                <span />
              </button>
            </div>

            {shape.roles.length > 1 ? (
              <div className="mini-callout">
                <Sparkles size={14} />
                <span>
                  This shape uses {shape.roles.length} material roles. Set them on the Blocks tab.
                </span>
              </div>
            ) : null}

            {groups.map(({ group, defs }) => (
              <section key={group} className="param-group">
                <h3>{group}</h3>
                {defs.map((def) => (
                  <ParamRow
                    key={def.key}
                    def={def}
                    value={params[def.key]}
                    onChange={(v) => setParam(def.key, v)}
                  />
                ))}
              </section>
            ))}

            {status === 'error' ? (
              <div className="error-box">
                <strong>Could not generate this shape</strong>
                <p>{error}</p>
              </div>
            ) : null}

            <section className="summary">
              <div className="summary-head">
                <h3>Build summary</h3>
                <span>{status === 'generating' ? 'rebuilding…' : model ? `${model.world.genMs} ms` : ''}</span>
              </div>
              <div className="summary-grid">
                <div>
                  <span>Blocks</span>
                  <strong>{model?.counts.total.toLocaleString() ?? '—'}</strong>
                </div>
                <div>
                  <span>Full</span>
                  <strong>{model?.counts.full.toLocaleString() ?? '—'}</strong>
                </div>
                <div>
                  <span>Slabs</span>
                  <strong>{model?.counts.slabs.toLocaleString() ?? '—'}</strong>
                </div>
                <div>
                  <span>Equivalent</span>
                  <strong>{model ? Math.round(model.counts.equivalents).toLocaleString() : '—'}</strong>
                </div>
                <div>
                  <span>Stacks (64)</span>
                  <strong>{model?.counts.stacks.toLocaleString() ?? '—'}</strong>
                </div>
                <div>
                  <span>Layers</span>
                  <strong>{model?.perLayer.length ?? '—'}</strong>
                </div>
              </div>
            </section>

            <p className="fine-print">
              Build from the bottom up with the layer dock. Enable build mode to ghost the layers
              above your current one.
            </p>
          </>
        ) : null}

        {tab === 'blocks' ? (
          <>
            <div className={`texture-settings ${textures ? 'on' : ''} ${textureStatus === 'error' ? 'has-error' : ''}`}>
              <span className="tex-icon big" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <div className="texture-settings-copy">
                <strong>Minecraft textures</strong>
                <p>
                  {textureStatus === 'loading'
                    ? `Loading ${textureLoaded}/${textureTotal || '…'}`
                    : textureStatus === 'error'
                      ? 'Mirror unavailable — flat colors'
                      : textures
                        ? `On · real ${TEXTURE_VERSION} block textures`
                        : `Use the real ${TEXTURE_VERSION} block textures`}
                </p>
              </div>
              <button
                className={`switch ${textures ? 'on' : ''}`}
                onClick={() => setTextures(!textures)}
                aria-pressed={textures}
                aria-label="Toggle Minecraft textures"
              >
                <span />
              </button>
            </div>
            <MaterialPicker />
          </>
        ) : null}
        {tab === 'export' ? <ExportPanel /> : null}
      </div>
    </aside>
  )
}

function ParamRow({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: ParamValue
  onChange: (v: ParamValue) => void
}) {
  if (def.kind === 'number') {
    return <ParamControl def={def} value={value} onChange={(v) => onChange(v)} />
  }
  if (def.kind === 'bool') {
    const on = Boolean(value)
    return (
      <button className={`switch-row ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
        <span>
          {def.label}
          {def.hint ? <small>{def.hint}</small> : null}
        </span>
        <span className={`switch ${on ? 'on' : ''}`}>
          <span />
        </span>
      </button>
    )
  }
  return (
    <div className="param">
      <div className="param-head">
        <label>{def.label}</label>
      </div>
      <div className="segmented">
        {def.options.map((opt) => (
          <button
            key={opt.value}
            className={value === opt.value ? 'active' : ''}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {def.hint ? <p className="param-hint">{def.hint}</p> : null}
    </div>
  )
}
