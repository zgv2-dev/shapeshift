import { getBlock } from './blocks'
import { buildRenderData } from './renderData'
import type { BlockState, LayerStat, ModelPayload } from './types'

export type FreeformBlocks = Map<string, BlockState>

export interface FreeformOrigin {
  x: number
  y: number
  z: number
}

export interface FreeformBuild {
  model: ModelPayload
  origin: FreeformOrigin
  blocks: FreeformBlocks
}

const AIR: BlockState = { name: 'minecraft:air', kind: 'block' }

export function freeformKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

export function parseFreeformKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(',').map(Number)
  return [x, y, z]
}

/** Remove empty Y levels so freeform layers stay contiguous, like generated models. */
export function compactFreeformBlocks(blocks: FreeformBlocks): FreeformBlocks {
  if (blocks.size === 0) return blocks
  const ys = new Set<number>()
  for (const key of blocks.keys()) ys.add(parseFreeformKey(key)[1])
  const sorted = [...ys].sort((a, b) => a - b)
  if (sorted.length === 0) return blocks
  const remap = new Map<number, number>()
  sorted.forEach((y, i) => remap.set(y, i))
  if (sorted.every((y, i) => y === i)) return blocks
  const next: FreeformBlocks = new Map()
  for (const [key, state] of blocks) {
    const [x, y, z] = parseFreeformKey(key)
    next.set(freeformKey(x, remap.get(y)!, z), state)
  }
  return next
}

export function freeformBlockState(blockId: string): BlockState {
  const def = getBlock(blockId)
  return {
    name: blockId,
    kind: 'block',
    color: def.color,
    transparent: def.transparent,
  }
}

export function freeformBounds(blocks: FreeformBlocks): {
  min: FreeformOrigin
  max: FreeformOrigin
} | null {
  if (blocks.size === 0) return null
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const key of blocks.keys()) {
    const [x, y, z] = parseFreeformKey(key)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  }
}

/** Copy a generated shape into editable absolute-coordinate blocks. */
export function modelToBlocks(model: ModelPayload): FreeformBlocks {
  const blocks: FreeformBlocks = new Map()
  const [nx, ny, nz] = model.dims
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const p = model.data[(y * nz + z) * nx + x]
        if (p === 0) continue
        const state = model.palette[p]
        if (!state || state.kind === 'block' && state.name === 'minecraft:air') continue
        blocks.set(freeformKey(x, y, z), {
          name: state.name,
          kind: state.kind,
          props: state.props,
          transparent: state.transparent,
          color: state.color,
        })
      }
    }
  }
  return blocks
}

/** Merge another generated shape into freeform blocks at an absolute offset. */
export function stampModel(
  blocks: FreeformBlocks,
  source: ModelPayload,
  offset: FreeformOrigin,
): FreeformBlocks {
  const next = new Map(blocks)
  const [nx, ny, nz] = source.dims
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const p = source.data[(y * nz + z) * nx + x]
        if (p === 0) continue
        const state = source.palette[p]
        if (!state) continue
        next.set(freeformKey(x + offset.x, y + offset.y, z + offset.z), {
          name: state.name,
          kind: state.kind,
          props: state.props,
          transparent: state.transparent,
          color: state.color,
        })
      }
    }
  }
  return next
}

function emptyLayer(): LayerStat {
  return { items: 0, equivalents: 0, full: 0, slabs: 0 }
}

function emptyModel(genMs: number): ModelPayload {
  return {
    dims: [1, 1, 1],
    data: new Uint8Array(1),
    palette: [AIR],
    perLayer: [emptyLayer()],
    counts: {
      total: 0,
      full: 0,
      bottom: 0,
      top: 0,
      slabs: 0,
      equivalents: 0,
      stacks: 0,
      visible: 0,
      paletteCount: 1,
    },
    shapeId: 'freeform',
    blocks: new Uint32Array(0),
    world: { genMs },
  }
}

/**
 * Rebuild a display/export model from freeform blocks. Coordinates are stored
 * absolutely; the returned origin tells the editor how to map a picked voxel
 * back into freeform space.
 */
export function buildFreeformModel(blocks: FreeformBlocks, genMs = 0): FreeformBuild {
  const compacted = compactFreeformBlocks(blocks)
  const bounds = freeformBounds(compacted)
  if (!bounds) return { model: emptyModel(genMs), origin: { x: 0, y: 0, z: 0 }, blocks: compacted }

  const { min, max } = bounds
  const nx = max.x - min.x + 1
  const ny = max.y - min.y + 1
  const nz = max.z - min.z + 1
  const data = new Uint8Array(nx * ny * nz)
  const palette: BlockState[] = [AIR]
  const paletteIndex = new Map<string, number>()
  const perLayer: LayerStat[] = Array.from({ length: ny }, emptyLayer)
  let total = 0
  let full = 0
  let bottom = 0
  let top = 0

  const paletteFor = (state: BlockState): number => {
    const key = `${state.name}|${state.kind}|${JSON.stringify(state.props ?? {})}`
    const prior = paletteIndex.get(key)
    if (prior !== undefined) return prior
    const idx = palette.length
    palette.push({
      name: state.name,
      kind: state.kind,
      props: state.props,
      transparent: state.transparent,
      color: state.color,
    })
    paletteIndex.set(key, idx)
    return idx
  }

  for (const [key, state] of compacted) {
    const [x, y, z] = parseFreeformKey(key)
    const lx = x - min.x
    const ly = y - min.y
    const lz = z - min.z
    if (lx < 0 || ly < 0 || lz < 0 || lx >= nx || ly >= ny || lz >= nz) continue
    const p = paletteFor(state)
    data[(ly * nz + lz) * nx + lx] = p
    const layer = perLayer[ly]
    layer.items += 1
    total += 1
    if (state.kind === 'block') {
      full += 1
      layer.full += 1
      layer.equivalents += 1
    } else {
      if (state.kind === 'bottom') bottom += 1
      else top += 1
      layer.slabs += 1
      layer.equivalents += 0.5
    }
  }

  const slabs = bottom + top
  const counts = {
    total,
    full,
    bottom,
    top,
    slabs,
    equivalents: total - slabs * 0.5,
    stacks: Math.ceil(total / 64),
    visible: total,
    paletteCount: palette.length,
  }
  const draft = {
    dims: [nx, ny, nz] as [number, number, number],
    data,
    palette,
    perLayer,
    counts,
  }
  const render = buildRenderData(draft)
  counts.visible = render.visible

  return {
    model: {
      ...draft,
      shapeId: 'freeform',
      blocks: render.blocks,
      world: { genMs },
    },
    origin: min,
    blocks: compacted,
  }
}
