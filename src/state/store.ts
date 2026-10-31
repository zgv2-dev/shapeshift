import { create } from 'zustand'
import { BLOCK_MAP } from '../core/blocks'
import { buildFreeformModel, freeformBlockState, modelToBlocks, stampModel, freeformBounds, type FreeformBlocks, type FreeformOrigin } from '../core/freeform'
import { buildRenderData } from '../core/renderData'
import { defaultMaterials, defaultParams, getShape, SHAPES } from '../core/shapes'
import type { BlockAtlas } from '../three/textures'
import type { MaterialSet, ModelPayload, ParamValue, RoleKey, ShapeCategory } from '../core/types'
import {
  LANGUAGE_STORAGE_KEY,
  detectLanguage,
  languageHtml,
  normalizeLanguage,
  storeLanguage,
  type Language,
} from '../i18n/languages'

export type ViewMode = '3d' | '2d'
export type InspectorTab = 'shape' | 'blocks' | 'export' | 'freeform'
export type FreeformTool = 'place' | 'remove'
export type Backdrop = 'studio' | 'sky' | 'nether' | 'end'

export interface FreeformEditHit {
  x: number
  y: number
  z: number
  normal: { x: number; y: number; z: number }
}

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
  language?: Language
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
  language: Language
  toast: { message: string; id: number } | null
  freeformActive: boolean
  freeformBlocks: FreeformBlocks | null
  freeformOrigin: FreeformOrigin
  freeformTool: FreeformTool
  freeformBlock: string
  freeformHistory: FreeformBlocks[]
  freeformFuture: FreeformBlocks[]

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
  setLanguage: (v: Language) => void
  showToast: (message: string) => void
  startFreeform: () => void
  exitFreeform: () => void
  setFreeformTool: (tool: FreeformTool) => void
  setFreeformBlock: (block: string) => void
  addShapeToFreeform: () => void
  editFreeform: (hit: FreeformEditHit) => void
  undoFreeform: () => void
  redoFreeform: () => void
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
  const numberOrNull = (key: string): number | null => {
    const raw = q.get(key)
    if (raw === null || raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }
  const ox = numberOrNull('ox')
  const oy = numberOrNull('oy')
  const oz = numberOrNull('oz')
  const layer = numberOrNull('layer')
  const language = normalizeLanguage(q.get('lang')) ?? undefined
  const hasOrigin = ox !== null || oy !== null || oz !== null
  return {
    shapeId,
    params,
    materials: materials as MaterialSet,
    detail: q.get('slabs') === '0' ? false : true,
    textures: q.get('tex') === '1' ? true : q.get('tex') === '0' ? false : undefined,
    mode: q.get('view') === '2d' ? '2d' : '3d',
    layer: layer ?? undefined,
    language,
    worldOrigin: hasOrigin
      ? { x: ox ?? 0, y: oy ?? 64, z: oz ?? 0 }
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
  | 'setLanguage'
  | 'showToast'
  | 'startFreeform'
  | 'exitFreeform'
  | 'setFreeformTool'
  | 'setFreeformBlock'
  | 'addShapeToFreeform'
  | 'editFreeform'
  | 'undoFreeform'
  | 'redoFreeform'
> {
  const stored = readStored()
  const query = readQuery()
  const storedLanguage =
    normalizeLanguage(
      typeof localStorage === 'undefined' ? null : localStorage.getItem(LANGUAGE_STORAGE_KEY),
    ) ??
    stored.language ??
    detectLanguage()
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
    language: query.language ?? storedLanguage,
    toast: null,
    freeformActive: false,
    freeformBlocks: null,
    freeformOrigin: { x: 0, y: 0, z: 0 },
    freeformTool: 'place',
    freeformBlock: materials.primary,
    freeformHistory: [],
    freeformFuture: [],
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

export const useStore = create<AppState>((set, get) => {
  const commitFreeform = (
    blocks: FreeformBlocks,
    history: FreeformBlocks[],
    future: FreeformBlocks[],
  ): void => {
    const started = performance.now()
    const built = buildFreeformModel(blocks, Math.round(performance.now() - started))
    const state = get()
    const oldTop = topNonEmpty(state.model)
    const newTop = topNonEmpty(built.model)
    const wasTop = state.layer >= oldTop || !state.buildMode
    set({
      freeformBlocks: built.blocks,
      freeformOrigin: built.origin,
      model: built.model,
      status: 'ready',
      error: null,
      layer: wasTop ? newTop : Math.min(state.layer, newTop),
      fitLayer: false,
      freeformHistory: history,
      freeformFuture: future,
    })
  }

  const sourceModel = (state: AppState): ModelPayload => {
    const shape = getShape(state.shapeId)
    const voxel = shape.generate({
      p: state.params,
      detail: state.detail,
      materials: state.materials,
      roleBlockNames: [state.materials.primary, state.materials.accent, state.materials.detail],
    }).finish()
    const render = buildRenderData(voxel)
    return {
      ...voxel,
      shapeId: state.shapeId,
      blocks: render.blocks,
      world: { genMs: 0 },
    }
  }

  const withHistory = (
    blocks: FreeformBlocks,
    state: AppState,
    previous: FreeformBlocks,
  ): void => {
    commitFreeform(
      blocks,
      [...state.freeformHistory, previous].slice(-40),
      [],
    )
  }

  return {
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
      const wasTop = s.model !== null && s.layer >= oldTop - 1
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

  setLanguage: (language) => {
    set({ language })
    storeLanguage(language)
    if (typeof document !== 'undefined') document.documentElement.lang = languageHtml(language)
  },

  showToast: (message) => {
    toastId += 1
    set({ toast: { message, id: toastId } })
    const id = toastId
    window.setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 2600)
  },

  startFreeform: () => {
    const state = get()
    if (state.freeformActive) return
    if (!state.model || state.model.counts.total === 0) {
      state.showToast('Generate a shape before opening the freeform editor')
      return
    }
    const blocks = modelToBlocks(state.model)
    const built = buildFreeformModel(blocks)
    set({
      freeformActive: true,
      freeformBlocks: built.blocks,
      freeformOrigin: built.origin,
      freeformBlock: state.materials.primary,
      freeformHistory: [],
      freeformFuture: [],
      model: built.model,
      status: 'ready',
      error: null,
      layer: topNonEmpty(built.model),
      fitLayer: false,
      buildMode: false,
      tab: 'freeform',
    })
  },

  exitFreeform: () =>
    set({
      freeformActive: false,
      freeformBlocks: null,
      freeformHistory: [],
      freeformFuture: [],
      layer: 0,
      fitLayer: true,
      buildMode: true,
      tab: 'shape',
    }),

  setFreeformTool: (tool) => set({ freeformTool: tool }),

  setFreeformBlock: (block) => {
    if (BLOCK_MAP.has(block)) set({ freeformBlock: block })
  },

  addShapeToFreeform: () => {
    const state = get()
    if (!state.freeformActive || !state.freeformBlocks) return
    const bounds = freeformBounds(state.freeformBlocks)
    const offset = { x: 0, y: bounds ? bounds.max.y + 1 : 0, z: 0 }
    const next = stampModel(state.freeformBlocks, sourceModel(state), offset)
    withHistory(next, state, new Map(state.freeformBlocks))
    state.showToast('Shape added above')
  },

  editFreeform: (hit) => {
    const state = get()
    if (!state.freeformActive || !state.freeformBlocks) return
    const blocks = new Map(state.freeformBlocks)
    const origin = state.freeformOrigin
    const gx = hit.x + origin.x
    const gy = hit.y + origin.y
    const gz = hit.z + origin.z
    if (state.freeformTool === 'remove') {
      blocks.delete(`${gx},${gy},${gz}`)
    } else {
      const nx = hit.normal?.x ?? 0
      const ny = hit.normal?.y ?? 1
      const nz = hit.normal?.z ?? 0
      blocks.set(`${gx + nx},${gy + ny},${gz + nz}`, freeformBlockState(state.freeformBlock))
    }
    withHistory(blocks, state, new Map(state.freeformBlocks))
  },

  undoFreeform: () => {
    const state = get()
    if (!state.freeformActive || !state.freeformBlocks || state.freeformHistory.length === 0) return
    const history = [...state.freeformHistory]
    const previous = history.pop()!
    const future = [...state.freeformFuture, new Map(state.freeformBlocks)].slice(-40)
    commitFreeform(previous, history, future)
  },

  redoFreeform: () => {
    const state = get()
    if (!state.freeformActive || !state.freeformBlocks || state.freeformFuture.length === 0) return
    const future = [...state.freeformFuture]
    const next = future.pop()!
    const history = [...state.freeformHistory, new Map(state.freeformBlocks)].slice(-40)
    commitFreeform(next, history, future)
  },
  }
})

