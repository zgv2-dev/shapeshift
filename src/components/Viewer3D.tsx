import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Box,
  Camera,
  Ghost,
  Grid,
  Maximize2,
  Moon,
  RotateCw,
  Scissors,
  Square,
  Sun,
} from 'lucide-react'
import { useStore } from '../state/store'
import { VoxelViewer } from '../three/VoxelViewer'

const BACKDROP_ORDER = ['studio', 'sky', 'nether', 'end'] as const
const BACKDROP_LABEL = { studio: 'Studio', sky: 'Sky', nether: 'Nether', end: 'End' }

export function Viewer3D() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<VoxelViewer | null>(null)
  const lastFitted = useRef('')
  const [sectionOpen, setSectionOpen] = useState(false)

  const model = useStore((s) => s.model)
  const layer = useStore((s) => s.layer)
  const buildMode = useStore((s) => s.buildMode)
  const ghost = useStore((s) => s.ghost)
  const grid = useStore((s) => s.grid)
  const autoRotate = useStore((s) => s.autoRotate)
  const cutaway = useStore((s) => s.cutaway)
  const backdrop = useStore((s) => s.backdrop)
  const mode = useStore((s) => s.mode)
  const worldOrigin = useStore((s) => s.worldOrigin)
  const atlas = useStore((s) => s.atlas)
  const textures = useStore((s) => s.textures)
  const setGrid = useStore((s) => s.setGrid)
  const setGhost = useStore((s) => s.setGhost)
  const setAutoRotate = useStore((s) => s.setAutoRotate)
  const setCutaway = useStore((s) => s.setCutaway)
  const setBackdrop = useStore((s) => s.setBackdrop)

  useEffect(() => {
    if (!hostRef.current) return
    const viewer = new VoxelViewer(hostRef.current, {
      onToast: (msg) => useStore.getState().showToast(msg),
    })
    viewerRef.current = viewer
    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!model) return
    const frame = lastFitted.current !== model.shapeId
    if (frame) lastFitted.current = model.shapeId
    viewerRef.current?.setModel(model, frame)
  }, [model])

  useEffect(() => {
    viewerRef.current?.setAtlasCanvas(atlas?.canvas ?? null, textures)
  }, [atlas, textures])

  useEffect(() => {
    viewerRef.current?.setView({
      layer,
      buildMode,
      ghost,
      grid,
      autoRotate,
      cutaway,
      backdrop,
      active: mode === '3d',
      origin: worldOrigin,
    })
  }, [layer, buildMode, ghost, grid, autoRotate, cutaway, backdrop, mode, worldOrigin])

  const themeIcon =
    backdrop === 'studio' ? <Sun size={15} /> : backdrop === 'sky' ? <Moon size={15} /> : <Sun size={15} />

  return (
    <div className={`viewer3d ${mode === '3d' ? 'active' : ''}`} ref={hostRef}>
      <div className="camera-tools" aria-label="Camera views">
        <button className="tool-btn" onClick={() => viewerRef.current?.setCamera('iso')} title="Isometric view">
          <Box size={16} />
        </button>
        <button className="tool-btn" onClick={() => viewerRef.current?.setCamera('front')} title="Front view">
          <Square size={16} />
        </button>
        <button className="tool-btn" onClick={() => viewerRef.current?.setCamera('top')} title="Top view">
          <ArrowUp size={16} />
        </button>
        <button className="tool-btn" onClick={() => viewerRef.current?.setCamera('fit')} title="Fit model">
          <Maximize2 size={16} />
        </button>
        <span className="tool-sep" />
        <button className="tool-btn" onClick={() => viewerRef.current?.screenshot()} title="Save a PNG screenshot">
          <Camera size={16} />
        </button>
      </div>

      <div className="viewer-tools">
        <button
          className={`tool-btn ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Auto-rotate"
        >
          <RotateCw size={16} />
        </button>
        <button
          className={`tool-btn ${grid ? 'active' : ''}`}
          onClick={() => setGrid(!grid)}
          title="Toggle grid"
        >
          <Grid size={16} />
        </button>
        <button
          className={`tool-btn ${ghost ? 'active' : ''}`}
          onClick={() => setGhost(!ghost)}
          title="Ghost the layers above the build layer"
        >
          <Ghost size={16} />
        </button>
        <button
          className={`tool-btn ${cutaway > 0 ? 'active' : ''}`}
          onClick={() => {
            setSectionOpen((v) => !v)
            if (cutaway === 0) setCutaway(0.3)
          }}
          title="Section cutaway"
        >
          <Scissors size={16} />
        </button>
        <button
          className="tool-btn"
          onClick={() =>
            setBackdrop(BACKDROP_ORDER[(BACKDROP_ORDER.indexOf(backdrop) + 1) % BACKDROP_ORDER.length])
          }
          title={`Backdrop: ${BACKDROP_LABEL[backdrop]}`}
        >
          {themeIcon}
        </button>
      </div>

      {sectionOpen || cutaway > 0 ? (
        <div className="section-control">
          <div className="section-head">
            <span>Section cut</span>
            <button onClick={() => { setCutaway(0); setSectionOpen(false) }}>Reset</button>
          </div>
          <input
            type="range"
            min="0"
            max="0.92"
            step="0.01"
            value={cutaway}
            onChange={(e) => setCutaway(Number(e.target.value))}
            aria-label="Section cut amount"
          />
        </div>
      ) : null}

      <div className="view-hint">
        <span><b>Drag</b> orbit</span>
        <span><b>Scroll</b> zoom</span>
        <span><b>Shift-drag</b> pan</span>
        <span><b>Click</b> copy coords</span>
      </div>

      {!model ? <div className="viewer-loader">Preparing voxels…</div> : null}
    </div>
  )
}
