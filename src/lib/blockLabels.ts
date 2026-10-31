import type { BlockState } from '../core/types'

export function prettyBlockName(name: string): string {
  return name
    .replace(/^minecraft:/, '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

/** Human-readable label that keeps top/bottom slab states distinguishable. */
export function blockStateLabel(state: Pick<BlockState, 'name' | 'kind'>): string {
  const label = prettyBlockName(state.name)
  return state.kind === 'block' ? label : `${label} (${state.kind})`
}
