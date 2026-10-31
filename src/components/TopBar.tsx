import { Bug, Copy, Download, Loader2, Menu, PanelRight, Shapes, TriangleAlert } from 'lucide-react'
import { getShape } from '../core/shapes'
import { buildShareUrl } from '../lib/stateUrl'
import { useStore } from '../state/store'
import { TEXTURE_VERSION } from '../core/versions'
import { LanguageSelect } from './LanguageSelect'

const nf = new Intl.NumberFormat('en-US')

export function TopBar() {
  const shapeId = useStore((s) => s.shapeId)
  const model = useStore((s) => s.model)
  const detail = useStore((s) => s.detail)
  const setDetail = useStore((s) => s.setDetail)
  const textures = useStore((s) => s.textures)
  const textureStatus = useStore((s) => s.textureStatus)
  const textureLoaded = useStore((s) => s.textureLoaded)
  const textureTotal = useStore((s) => s.textureTotal)
  const setTextures = useStore((s) => s.setTextures)
  const setTab = useStore((s) => s.setTab)
  const setInspectorOpen = useStore((s) => s.setInspectorOpen)
  const setLibraryOpen = useStore((s) => s.setLibraryOpen)
  const showToast = useStore((s) => s.showToast)
  const shape = getShape(shapeId)
  const counts = model?.counts
  const dims = model?.dims

  const share = async () => {
    const url = buildShareUrl(useStore.getState())
    try {
      await navigator.clipboard.writeText(url)
      showToast('Share link copied')
    } catch {
      showToast('Copy failed — select the URL from the address bar')
    }
  }

  return (
    <header className="topbar">
      <div className="brand">
        <button
          className="icon-btn mobile-only"
          onClick={() => setLibraryOpen(true)}
          aria-label="Open shape library"
        >
          <Menu size={18} />
        </button>
        <a className="brand-home" href="/" title="Back to the ShapeShiftMC landing page">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M20 3 35 11 20 19 5 11Z" fill="#d9ff6b" />
            <path d="M5 11v18l15 8V19Z" fill="#7da437" />
            <path d="M35 11v18l-15 8V19Z" fill="#4d7122" />
          </svg>
          <div className="brand-text">
            <span className="brand-name">ShapeShiftMC</span>
            <span className="brand-sub">Minecraft shape studio</span>
          </div>
        </a>
      </div>

      <div className="topbar-center">
        <div className="shape-heading">
          <span className="shape-kicker">{shape.category}</span>
          <h1>{shape.name}</h1>
        </div>
        <div className="topbar-stats">
          <span title="Model dimensions">
            <Shapes size={13} />
            {dims ? `${dims[0]}×${dims[1]}×${dims[2]}` : '—'}
          </span>
          <span title="Total blocks, counting half slabs individually">
            <strong>{counts ? nf.format(counts.total) : '—'}</strong> blocks
          </span>
          {counts && counts.slabs > 0 ? (
            <span className="stat-slabs" title="Half slabs used for a smoother curve">
              {nf.format(counts.slabs)} slabs
            </span>
          ) : null}
        </div>
      </div>

      <div className="topbar-actions">
        <div className="topbar-language">
          <LanguageSelect />
        </div>
        <button
          className={`slab-toggle ${detail ? 'active' : ''}`}
          onClick={() => setDetail(!detail)}
          aria-pressed={detail}
          title="Generate curved surfaces with half-height slabs for twice the vertical detail"
        >
          <span className="slab-icon">
            <i />
          </span>
          <span className="slab-copy">
            <strong>½ slabs</strong>
            <small>{detail ? 'on' : 'off'}</small>
          </span>
        </button>
        <button
          className={`slab-toggle tex-toggle ${textures ? 'active' : ''} ${textureStatus === 'error' ? 'error' : ''}`}
          onClick={() => setTextures(!textures)}
          aria-pressed={textures}
          title={`Use real Minecraft ${TEXTURE_VERSION} block textures. Loaded at runtime from a public asset mirror.`}
        >
          {textureStatus === 'loading' ? (
            <Loader2 size={15} className="spin" />
          ) : textureStatus === 'error' ? (
            <TriangleAlert size={15} />
          ) : (
            <span className="tex-icon" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
          <span className="slab-copy tex-copy">
            <strong>Textures</strong>
            <small>
              {textureStatus === 'loading'
                ? `${textureLoaded}/${textureTotal || '—'}`
                : textureStatus === 'error'
                  ? 'failed'
                  : textures
                    ? 'on'
                    : 'off'}
            </small>
          </span>
        </button>
        <a
          className="icon-btn topbar-bug"
          href="https://github.com/zgv2-dev/shapeshift/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          title="Report a bug"
          aria-label="Report a bug"
        >
          <Bug size={16} />
        </a>
        <button className="btn ghost icon-only-mobile" onClick={share} title="Copy share link">
          <Copy size={15} />
          <span className="hide-small">Share</span>
        </button>
        <button
          className="btn primary"
          onClick={() => {
            setTab('export')
            setInspectorOpen(true)
          }}
        >
          <Download size={15} />
          Export
        </button>
        <button
          className="icon-btn mobile-only"
          onClick={() => setInspectorOpen(true)}
          aria-label="Open controls"
        >
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  )
}

