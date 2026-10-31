import { describe, expect, it } from 'vitest'
import { blockStateLabel, prettyBlockName } from '../src/lib/blockLabels'

describe('block labels', () => {
  it('pretty-prints vanilla block names', () => {
    expect(prettyBlockName('minecraft:smooth_stone')).toBe('Smooth Stone')
    expect(prettyBlockName('minecraft:gold_block')).toBe('Gold Block')
  })

  it('keeps top and bottom slab states distinguishable', () => {
    expect(blockStateLabel({ name: 'minecraft:smooth_stone_slab', kind: 'bottom' })).toBe(
      'Smooth Stone Slab (bottom)',
    )
    expect(blockStateLabel({ name: 'minecraft:smooth_stone_slab', kind: 'top' })).toBe(
      'Smooth Stone Slab (top)',
    )
    expect(blockStateLabel({ name: 'minecraft:smooth_stone', kind: 'block' })).toBe('Smooth Stone')
  })
})
