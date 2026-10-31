import { describe, expect, it } from 'vitest'
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  TEXTURE_COUNT,
  UNIQUE_TEXTURES,
  tileIndicesForState,
} from '../src/three/textures'
import { BLOCKS } from '../src/core/blocks'
import { TEXTURE_VERSION } from '../src/core/versions'

describe('texture atlas layout', () => {
  it('targets the latest stable texture release', () => {
    expect(TEXTURE_VERSION).toBe('26.3')
  })

  it('fits every block face into the atlas', () => {
    expect(TEXTURE_COUNT).toBeLessThanOrEqual(ATLAS_COLS * ATLAS_ROWS)
    expect(new Set(UNIQUE_TEXTURES).size).toBe(UNIQUE_TEXTURES.length)
    for (const block of BLOCKS) {
      const tiles = tileIndicesForState(block.id)
      expect(tiles, block.id).not.toBeNull()
      expect(tiles!.side).toBeGreaterThanOrEqual(0)
      expect(tiles!.side).toBeLessThan(TEXTURE_COUNT)
    }
  })

  it('maps slabs back to their base block texture', () => {
    const full = tileIndicesForState('minecraft:smooth_stone')!
    const slab = tileIndicesForState('minecraft:smooth_stone_slab')!
    expect(slab).toEqual(full)
  })

  it('uses the vanilla quartz face textures', () => {
    const q = tileIndicesForState('minecraft:quartz_block')!
    const names = new Set(UNIQUE_TEXTURES)
    expect(names.has('quartz_block_side')).toBe(true)
    expect(names.has('quartz_block_top')).toBe(true)
    expect(q.side).not.toBe(q.top)
  })

  it('has a smooth quartz fallback texture', () => {
    const q = tileIndicesForState('minecraft:smooth_quartz')!
    expect(UNIQUE_TEXTURES[q.side]).toBe('quartz_block_bottom')
  })
})
