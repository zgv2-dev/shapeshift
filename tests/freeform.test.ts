import { describe, expect, it } from 'vitest'
import { buildRenderData } from '../src/core/renderData'
import { defaultMaterials, defaultParams, getShape } from '../src/core/shapes'
import {
  buildFreeformModel,
  compactFreeformBlocks,
  freeformBlockState,
  freeformKey,
  modelToBlocks,
  stampModel,
} from '../src/core/freeform'
import type { GenerationContext, ModelPayload } from '../src/core/types'

function sourceModel(shapeId = 'sphere'): ModelPayload {
  const shape = getShape(shapeId)
  const materials = defaultMaterials(shape)
  const ctx: GenerationContext = {
    p: defaultParams(shape),
    detail: true,
    materials,
    roleBlockNames: [materials.primary, materials.accent, materials.detail],
  }
  const model = shape.generate(ctx).finish()
  return {
    ...model,
    shapeId,
    blocks: buildRenderData(model).blocks,
    world: { genMs: 0 },
  }
}

describe('freeform model', () => {
  it('round-trips a generated shape without empty layers', () => {
    const source = sourceModel()
    const blocks = modelToBlocks(source)
    const built = buildFreeformModel(blocks)
    expect(built.model.counts.total).toBe(source.counts.total)
    expect(built.model.perLayer.every((layer) => layer.items > 0)).toBe(true)
    expect(built.model.dims[1]).toBe(built.model.perLayer.length)
  })

  it('compacts gaps and can stamp another shape above', () => {
    const blocks = new Map()
    blocks.set(freeformKey(0, 0, 0), freeformBlockState('minecraft:smooth_stone'))
    blocks.set(freeformKey(0, 3, 0), freeformBlockState('minecraft:glass'))
    const compacted = compactFreeformBlocks(blocks)
    expect([...compacted.keys()].sort()).toEqual(['0,0,0', '0,1,0'])
    const built = buildFreeformModel(blocks)
    expect(built.model.perLayer.every((layer) => layer.items > 0)).toBe(true)

    const source = sourceModel('torus')
    const merged = stampModel(compacted, source, { x: 0, y: 2, z: 0 })
    expect(merged.size).toBe(compacted.size + source.counts.total)
    expect(buildFreeformModel(merged).model.counts.total).toBe(merged.size)
  })
})
