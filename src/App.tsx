import { useEffect, useState } from 'react'
import { Box, Grid2X2, Loader2, TriangleAlert } from 'lucide-react'
import { TopBar } from './components/TopBar'
import { Library } from './components/Library'
import { Viewer3D } from './components/Viewer3D'
import { Blueprint2D } from './components/Blueprint2D'
import { LayerDock } from './components/LayerDock'
import { Inspector } from './components/Inspector'
import { useStore } from './state/store'
import { getShape } from './core/shapes'
import { TEXTURE_VERSION } from './core/versions'
import type { ModelPayload } from './core/types'
import { persistState } from './lib/stateUrl'
import { getCachedAtlas, loadBlockAtlas } from './three/textures'

function useGenerator() {
  const [worker, setWorker] = useState<Worker | null>(null)
  const shapeId = useStore((s) => s.shapeId)
  const params = useStore((s) => s.params)
  const materials = useStore((s) => s.materials)
  const detail = useStore((s) => s.detail)

  useEffect(() => {
    const w = new Worker(new URL('./worker/generator.worker.ts', import.meta.url), {
      type: 'module',
    })
    w.onmessage = (event: MessageEvent<{ id: number; ok: boolean; model?: unknown; error?: string }>) => {
      const data = event.data
      if (!data.ok) {
        useStore.getState().setStatus('error', data.error ?? 'Unknown generation error')
        return
      }
      useStore.getState().setModel(data.model as ModelPayload)
    }
    setWorker(w)
    return () => {
      w.terminate()
      setWorker(null)
    }
  }, [])

  useEffect(() => {
    if (!worker) return
    const timer = window.setTimeout(() => {
      useStore.getState().setStatus('generating')
      worker.postMessage({ shapeId, params, materials, detail })
    }, 90)
    return () => window.clearTimeout(timer)
  }, [worker, shapeId, params, materials, detail])
}

function useTextureLoader() {
  const textures = useStore((s) => s.textures)

  useEffect(() => {
    if (!textures) {
      const store = useStore.getState()
      if (store.textureStatus === 'loading' && !store.atlas) store.setTextureStatus('idle')
      return
    }
    const store = useStore.getState()
    if (store.atlas) {
      store.setTextureStatus('ready', store.atlas.loaded, store.atlas.total)
      return
    }
    const cached = getCachedAtlas()
    if (cached) {
      store.setAtlas(cached)
      store.setTextureStatus('ready', cached.loaded, cached.total)
      return
    }
    let cancelled = false
    store.setTextureStatus('loading', 0, 0)
    loadBlockAtlas((loaded, total) => {
      if (!cancelled) useStore.getState().setTextureStatus('loading', loaded, total)
    })
      .then((atlas) => {
        if (cancelled) return
        const current = useStore.getState()
        current.setAtlas(atlas)
        current.setTextureStatus('ready', atlas.loaded, atlas.total)
        current.showToast(
          atlas.missing.length
            ? `Minecraft ${TEXTURE_VERSION} textures loaded — ${atlas.loaded}/${atlas.total} (${atlas.missing.length} missing)`
            : `Minecraft ${TEXTURE_VERSION} textures loaded — ${atlas.loaded} block textures`,
        )
      })
      .catch(() => {
        if (cancelled) return
        const current = useStore.getState()
        current.setTextures(false)
        current.setTextureStatus('error')
        current.showToast(`Minecraft ${TEXTURE_VERSION} texture mirror unreachable — using flat colors`)
      })
    return () => {
      cancelled = true
    }
  }, [textures])
}

export default function App() {
  useGenerator()
  useTextureLoader()
  const shapeId = useStore((s) => s.shapeId)
  const shape = getShape(shapeId)

  useEffect(() => {
    const structural = shape.category === 'structures'
    document.title = structural ? `${shape.name} — Shapeshift` : `${shape.name} Generator — Shapeshift`
    const description = document.querySelector('meta[name="description"]')
    if (description) {
      description.setAttribute(
        'content',
        `${shape.name}: ${shape.tagline} Build it with half-slab detail, real textures and layer blueprints, then export to Litematica, WorldEdit or a structure block.`,
      )
    }
  }, [shape])
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const status = useStore((s) => s.status)
  const model = useStore((s) => s.model)
  const error = useStore((s) => s.error)
  const libraryOpen = useStore((s) => s.libraryOpen)
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  const setLibraryOpen = useStore((s) => s.setLibraryOpen)
  const setInspectorOpen = useStore((s) => s.setInspectorOpen)
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (event.key === 'Escape') (target as HTMLInputElement).blur()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      switch (event.key) {
        case '1':
          setMode('3d')
          break
        case '2':
          setMode('2d')
          break
        case 'ArrowRight':
        case 'ArrowUp':
          event.preventDefault()
          useStore.getState().stepLayer(1)
          break
        case 'ArrowLeft':
        case 'ArrowDown':
          event.preventDefault()
          useStore.getState().stepLayer(-1)
          break
        case 'g':
          useStore.getState().setGrid(!useStore.getState().grid)
          break
        case 'b':
          useStore.getState().setBuildMode(!useStore.getState().buildMode)
          break
        case 'e':
          useStore.getState().setTab('export')
          setInspectorOpen(true)
          break
        case 'Escape':
          setLibraryOpen(false)
          setInspectorOpen(false)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setMode, setInspectorOpen, setLibraryOpen])

  const persistKey = useStore((s) =>
    [
      s.shapeId,
      JSON.stringify(s.params),
      JSON.stringify(s.materials),
      s.detail,
      s.textures,
      s.mode,
      s.layer,
      s.worldOrigin.x,
      s.worldOrigin.y,
      s.worldOrigin.z,
      s.backdrop,
      s.buildMode,
      s.ghost,
      s.grid,
    ].join('|'),
  )

  useEffect(() => {
    const timer = window.setTimeout(() => persistState(useStore.getState()), 450)
    return () => window.clearTimeout(timer)
  }, [persistKey])

  return (
    <div className="app-shell">
      <TopBar />
      <Library />
      <main className="stage">
        <div className="stage-top">
          <div className="view-switch" role="tablist" aria-label="View mode">
            <button
              className={mode === '3d' ? 'active' : ''}
              onClick={() => setMode('3d')}
              title="3D viewer (1)"
            >
              <Box size={15} /> 3D
            </button>
            <button
              className={mode === '2d' ? 'active' : ''}
              onClick={() => setMode('2d')}
              title="Blueprint (2)"
            >
              <Grid2X2 size={15} /> Blueprint
            </button>
          </div>
          {status === 'generating' && model ? (
            <div className="generating-chip">
              <Loader2 size={13} className="spin" /> rebuilding
            </div>
          ) : null}
          {error ? (
            <div className="generating-chip error">
              <TriangleAlert size={13} /> {error}
            </div>
          ) : null}
        </div>

        <div className="stage-panes">
          <Viewer3D />
          <Blueprint2D />
        </div>
        <LayerDock />
      </main>
      <Inspector />

      {libraryOpen || inspectorOpen ? (
        <div
          className="drawer-backdrop"
          onClick={() => {
            setLibraryOpen(false)
            setInspectorOpen(false)
          }}
        />
      ) : null}

      {toast ? <div className="toast">{toast.message}</div> : null}
    </div>
  )
}
