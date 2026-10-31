import type { AppState } from '../state/store'

export function buildQuery(state: AppState): string {
  const q = new URLSearchParams()
  q.set('shape', state.shapeId)
  for (const [key, value] of Object.entries(state.params)) {
    q.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  q.set('mp', state.materials.primary)
  q.set('ma', state.materials.accent)
  q.set('md', state.materials.detail)
  q.set('slabs', state.detail ? '1' : '0')
  q.set('tex', state.textures ? '1' : '0')
  q.set('view', state.mode)
  q.set('layer', String(state.layer))
  q.set('lang', state.language)
  if (state.worldOrigin.x !== 0 || state.worldOrigin.y !== 64 || state.worldOrigin.z !== 0) {
    q.set('ox', String(state.worldOrigin.x))
    q.set('oy', String(state.worldOrigin.y))
    q.set('oz', String(state.worldOrigin.z))
  }
  return q.toString()
}

export function buildShareUrl(state: AppState): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}?${buildQuery(state)}`
}

export function persistState(state: AppState): void {
  if (typeof window === 'undefined') return
  try {
    const query = buildQuery(state)
    const url = `${window.location.pathname}?${query}`
    window.history.replaceState(null, '', url)
    window.localStorage.setItem(
      'shapeshift:v1',
      JSON.stringify({
        shapeId: state.shapeId,
        params: state.params,
        materials: state.materials,
        detail: state.detail,
        textures: state.textures,
        mode: state.mode,
        layer: state.layer,
        worldOrigin: state.worldOrigin,
        backdrop: state.backdrop,
        buildMode: state.buildMode,
        ghost: state.ghost,
        grid: state.grid,
        language: state.language,
      }),
    )
  } catch {
    /* storage or history can be unavailable in private frames */
  }
}
