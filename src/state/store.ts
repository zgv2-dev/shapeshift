import { create } from 'zustand'
import { BLOCK_MAP } from '../core/blocks'
import { defaultMaterials, defaultParams, getShape, SHAPES } from '../core/shapes'
import type { BlockAtlas } from '../three/textures'
import type { MaterialSet, ModelPayload, ParamValue, RoleKey, ShapeCategory } from '../core/types'

export type ViewMode = '3d' | '2d'
export type InspectorTab = 'shape' | 'blocks' | 'export'
export type Backdrop = 'studio' | 'sky' | 'nether' | 'end'

export interface WorldOrigin {
  x: number
  y: number
  z: number
}

interface PersistedState {
  shapeId?: string
  params?: Record<string, ParamValue>
  materials?: MaterialSet
  detail?: boolean
  mode?: ViewMode
  layer?: number
  textures?: boolean
  worldOrigin?: WorldOrigin
  backdrop?: Backdrop
  buildMode?: boolean
  ghost?: boolean
  grid?: boolean
  cutaway?: number
}

export interface AppState {
  shapeId: string
  params: Record<string, ParamValue>
  materials: MaterialSet
  detail: boolean
  textures: boolean
  textureStatus: 'idle' | 'loading' | 'ready' | 'error'
  textureLoaded: number
  textureTotal: number
  atlas: BlockAtlas | null
  layer: number
  fitLayer: boolean
  buildMode: boolean
  ghost: boolean
  grid: boolean
  cutaway: number
  mode: ViewMode
  tab: InspectorTab
  backdrop: Backdrop
  worldOrigin: WorldOrigin
  model: ModelPayload | null
  status: 'idle' | 'generating' | 'ready' | 'error'
  error: string | null
  autoRotate: boolean
  search: string
  category: ShapeCategory | 'all'
  libraryOpen: boolean
  inspectorOpen: boolean
  pngNonce: number
  toast: { message: string; id: number } | null

  setShape: (id: string) => void
  setParam: (key: string, value: ParamValue) => void
  setMaterial: (role: RoleKey, block: string) => void
  resetMaterials: () => void
  setDetail: (v: boolean) => void
  setTextures: (v: boolean) => void
  setTextureStatus: (status: 'idle' | 'loading' | 'ready' | 'error', loaded?: number, total?: number) => void
  setAtlas: (atlas: BlockAtlas | null) => void
  setLayer: (n: number) => void
  stepLayer: (delta: number) => void
  setBuildMode: (v: boolean) => void
  setGhost: (v: boolean) => void
  setGrid: (v: boolean) => void
  setCutaway: (v: number) => void
  setMode: (v: ViewMode) => void
  setTab: (v: InspectorTab) => void
  setBackdrop: (v: Backdrop) => void
  setWorldOrigin: (v: WorldOrigin) => void
  setModel: (m: ModelPayload) => void
  setStatus: (s: AppState['status'], error?: string | null) => void
  setAutoRotate: (v: boolean) => void
  setSearch: (v: string) => void
  setCategory: (v: ShapeCategory | 'all') => void
  setLibraryOpen: (v: boolean) => void
  setInspectorOpen: (v: boolean) => void
  requestPng: () => void
  showToast: (message: string) => void
}

const STORAGE_KEY = 'shapeshift:v1'

function readStored(): PersistedState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : {}
  } catch {
    return {}
  }
}

function readQuery(): PersistedState {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  if ([...q.keys()].length === 0) return {}
  const shapeId = q.get('shape') ?? undefined
  const shape = getShape(shapeId ?? 'sphere')
  const params: Record<string, ParamValue> = {}
  for (const def of shape.params) {
    const raw = q.get(def.key)
    if (raw === null) continue
    if (def.kind === 'bool') params[def.key] = raw === '1' || raw === 'true'
    else if (def.kind === 'select') {
      if (def.options.some((o) => o.value === raw)) params[def.key] = raw
    } else {
      const n = Number(raw)
      if (Number.isFinite(n)) params[def.key] = Math.max(def.min, Math.min(def.max, n))
    }
  }
  const materials: Partial<MaterialSet> = {}
  const mp = q.get('mp')
  const ma = q.get('ma')
  const md = q.get('md')
  if (mp && BLOCK_MAP.has(mp)) materials.primary = mp
  if (ma && BLOCK_MAP.has(ma)) materials.accent = ma
  if (md && BLOCK_MAP.has(md)) materials.detail = md
  const ox = Number(q.get('ox'))
  const oy = Number(q.get('oy'))
  const oz = Number(q.get('oz'))
  const layer = Number(q.get('layer'))
  return {
    shapeId,
    params,
    materials: materials as MaterialSet,
    detail: q.get('slabs') === '0' ? false : true,
    textures: q.get('tex') === '1' ? true : q.get('tex') === '0' ? false : undefined,
    mode: q.get('view') === '2d' ? '2d' : '3d',
    layer: Number.isFinite(layer) ? layer : undefined,
    worldOrigin:
      Number.isFinite(ox) && Number.isFinite(oy) && Number.isFinite(oz)
        ? { x: ox, y: oy, z: oz }
        : undefined,
  }
}

function initialState(): Omit<
  AppState,
  | 'setShape'
  | 'setParam'
  | 'setMaterial'
  | 'resetMaterials'
  | 'setDetail'
  | 'setTextures'
  | 'setTextureStatus'
  | 'setAtlas'
  | 'setLayer'
  | 'stepLayer'
  | 'setBuildMode'
  | 'setGhost'
  | 'setGrid'
  | 'setCutaway'
  | 'setMode'
  | 'setTab'
  | 'setBackdrop'
  | 'setWorldOrigin'
  | 'setModel'
  | 'setStatus'
  | 'setAutoRotate'
  | 'setSearch'
  | 'setCategory'
  | 'setLibraryOpen'
  | 'setInspectorOpen'
  | 'requestPng'
  | 'showToast'
> {
  const stored = readStored()
  const query = readQuery()
  const known = SHAPES.some((s) => s.id === (query.shapeId ?? stored.shapeId))
  const shape = getShape(known ? (query.shapeId ?? stored.shapeId)! : 'sphere')
  const baseParams = defaultParams(shape)
  const params = {
    ...baseParams,
    ...(known && stored.shapeId === shape.id ? stored.params : {}),
    ...(query.params ?? {}),
  }
  const baseMats = defaultMaterials(shape)
  const materials = {
    ...baseMats,
    ...(known && stored.shapeId === shape.id ? stored.materials : {}),
    ...(query.materials ?? {}),
  }
  return {
    shapeId: shape.id,
    params,
    materials,
    detail: query.detail ?? stored.detail ?? true,
    textures: query.textures ?? stored.textures ?? false,
    textureStatus: 'idle',
    textureLoaded: 0,
    textureTotal: 0,
    atlas: null,
    layer: query.layer ?? stored.layer ?? 0,
    fitLayer: query.layer === undefined,
    buildMode: stored.buildMode ?? true,
    ghost: stored.ghost ?? true,
    grid: stored.grid ?? true,
    cutaway: 0,
    mode: query.mode ?? stored.mode ?? '3d',
    tab: 'shape',
    backdrop: stored.backdrop ?? 'studio',
    worldOrigin: query.worldOrigin ?? stored.worldOrigin ?? { x: 0, y: 64, z: 0 },
    model: null,
    status: 'idle',
    error: null,
    autoRotate: false,
    search: '',
    category: 'all',
    libraryOpen: false,
    inspectorOpen: false,
    pngNonce: 0,
    toast: null,
  }
}

function topNonEmpty(model: ModelPayload | null): number {
  if (!model) return 0
  for (let i = model.perLayer.length - 1; i >= 0; i--) {
    if (model.perLayer[i].items > 0) return i
  }
  return 0
}

let toastId = 0

export const useStore = create<AppState>((set, get) => ({
  ...initialState(),

  setShape: (id) => {
    if (id === get().shapeId) return
    const shape = getShape(id)
    set({
      shapeId: shape.id,
      params: defaultParams(shape),
      materials: defaultMaterials(shape),
      fitLayer: true,
      layer: 0,
      error: null,
    })
  },

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),

  setMaterial: (role, block) =>
    set((s) => ({ materials: { ...s.materials, [role]: block } })),

  resetMaterials: () => set((s) => ({ materials: defaultMaterials(getShape(s.shapeId)) })),

  setDetail: (v) => set({ detail: v }),
  setTextures: (v) => set({ textures: v }),
  setTextureStatus: (status, loaded = 0, total = 0) =>
    set({ textureStatus: status, textureLoaded: loaded, textureTotal: total }),
  setAtlas: (atlas) => set({ atlas }),

  setLayer: (n) => {
    const model = get().model
    const max = model ? topNonEmpty(model) : 0
    set({ layer: Math.max(0, Math.min(max, n)), fitLayer: false, buildMode: true })
  },

  stepLayer: (delta) => {
    const model = get().model
    if (!model) return
    get().setLayer(get().layer + delta)
  },

  setBuildMode: (v) => set({ buildMode: v }),
  setGhost: (v) => set({ ghost: v }),
  setGrid: (v) => set({ grid: v }),
  setCutaway: (v) => set({ cutaway: Math.max(0, Math.min(1, v)) }),
  setMode: (v) => set({ mode: v }),
  setTab: (v) => set({ tab: v }),
  setBackdrop: (v) => set({ backdrop: v }),
  setWorldOrigin: (v) => set({ worldOrigin: v }),

  setModel: (m) =>
    set((s) => {
      const oldTop = topNonEmpty(s.model)
      const newTop = topNonEmpty(m)
      const wasTop = s.layer >= oldTop - 1
      return {
        model: m,
        status: 'ready',
        error: null,
        layer: s.fitLayer || wasTop ? newTop : Math.min(s.layer, newTop),
        fitLayer: false,
      }
    }),

  setStatus: (status, error = null) => set({ status, error }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setSearch: (v) => set({ search: v }),
  setCategory: (v) => set({ category: v }),
  setLibraryOpen: (v) => set({ libraryOpen: v }),
  setInspectorOpen: (v) => set({ inspectorOpen: v }),
  requestPng: () => set((s) => ({ pngNonce: s.pngNonce + 1 })),

  showToast: (message) => {
    toastId += 1
    set({ toast: { message, id: toastId } })
    const id = toastId
    window.setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 2600)
  },
}))

