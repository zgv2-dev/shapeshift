import { useEffect, useMemo, useState } from 'react'
import { Box, ClipboardCopy, Download, FileBox, FileText, Image, MapPin } from 'lucide-react'
import { getShape } from '../core/shapes'
import {
  EXPORT_LABELS,
  exportModel,
  type ExportFormat,
} from '../core/export/download'
import { buildShareUrl } from '../lib/stateUrl'
import { useStore } from '../state/store'

const FORMATS: { id: ExportFormat; icon: typeof FileBox }[] = [
  { id: 'litematic', icon: FileBox },
  { id: 'schem', icon: Box },
  { id: 'structure', icon: FileText },
  { id: 'blocks', icon: FileText },
  { id: 'coords', icon: MapPin },
]

export function ExportPanel() {
  const model = useStore((s) => s.model)
  const shapeId = useStore((s) => s.shapeId)
  const worldOrigin = useStore((s) => s.worldOrigin)
  const setWorldOrigin = useStore((s) => s.setWorldOrigin)
  const requestPng = useStore((s) => s.requestPng)
  const showToast = useStore((s) => s.showToast)
  const shape = getShape(shapeId)
  const [format, setFormat] = useState<ExportFormat>('litematic')
  const [name, setName] = useState(`${shape.name} build`)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(`${shape.name} build`)
  }, [shape.name])

  const slabExample = useMemo(() => {
    const state = model?.palette.find((p) => p.kind !== 'block')
    if (!state) return null
    return `${state.name}[type=${state.kind}]`
  }, [model])

  const runExport = async () => {
    if (!model) return
    setBusy(true)
    try {
      await exportModel(format, model, shapeId, { name, origin: worldOrigin })
      showToast(`${EXPORT_LABELS[format].label} downloaded`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(useStore.getState()))
      showToast('Share link copied')
    } catch {
      showToast('Could not copy the share link')
    }
  }

  return (
    <div className="export-panel">
      <div className="material-head">
        <div>
          <p className="eyebrow">Take it in-world</p>
          <h3>Export</h3>
        </div>
        <span className="data-version" title="Minecraft 1.20.1 block state data version">
          1.20.1
        </span>
      </div>

      <div className="format-list">
        {FORMATS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={`format-card ${format === id ? 'active' : ''}`}
            onClick={() => setFormat(id)}
          >
            <span className="format-icon">
              <Icon size={16} />
            </span>
            <span>
              <strong>{EXPORT_LABELS[id].label}</strong>
              <small>{EXPORT_LABELS[id].note}</small>
            </span>
            <span className="format-radio" />
          </button>
        ))}
      </div>

      <label className="field-label">
        Build name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
      </label>

      <button className="btn primary wide" onClick={runExport} disabled={!model || busy}>
        <Download size={16} />
        {busy ? 'Preparing…' : `Download ${EXPORT_LABELS[format].ext}`}
      </button>

      <div className="export-secondary">
        <button className="btn ghost" onClick={requestPng} disabled={!model}>
          <Image size={15} />
          Layer PNG
        </button>
        <button className="btn ghost" onClick={share}>
          <ClipboardCopy size={15} />
          Share link
        </button>
      </div>

      <div className="export-note">
        <strong>Slab-safe.</strong> Bottom and top slabs are written with their <code>type</code> block state,
        e.g. <code>{slabExample ?? 'smooth_stone_slab[type=bottom]'}</code>. Interior blocks are
        included in the file even though the viewer culls them.
      </div>

      <div className="subsection">
        <div className="subsection-head">
          <h4><MapPin size={14} /> Build origin</h4>
          <span>used by hover coordinates & CSV</span>
        </div>
        <div className="origin-grid">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <label key={axis}>
              <span>{axis.toUpperCase()}</span>
              <input
                type="number"
                value={worldOrigin[axis]}
                onChange={(e) =>
                  setWorldOrigin({ ...worldOrigin, [axis]: Number(e.target.value) || 0 })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="export-summary">
        <div><span>Blocks</span><strong>{model?.counts.total.toLocaleString() ?? '—'}</strong></div>
        <div><span>Slabs</span><strong>{model?.counts.slabs.toLocaleString() ?? '—'}</strong></div>
        <div><span>Stacks</span><strong>{model?.counts.stacks.toLocaleString() ?? '—'}</strong></div>
        <div>
          <span>Bounds</span>
          <strong>{model ? `${model.dims[0]}×${model.dims[1]}×${model.dims[2]}` : '—'}</strong>
        </div>
      </div>

      <p className="fine-print">
        Litematica reads the packed long array in YZX order; Sponge `.schem` v2 stores varint block
        indices. Both are generated in-browser — nothing is uploaded.
      </p>
    </div>
  )
}
