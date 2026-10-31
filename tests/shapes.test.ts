import { describe, expect, it } from 'vitest'
import { SHAPES, defaultMaterials, defaultParams } from '../src/core/shapes'
import { buildRenderData } from '../src/core/renderData'
import type { GenerationContext } from '../src/core/types'

function build(shapeId: string, detail = true, overrides: Record<string, number | boolean | string> = {}) {
  const shape = SHAPES.find((s) => s.id === shapeId)!
  const mats = defaultMaterials(shape)
  const ctx: GenerationContext = {
    p: { ...defaultParams(shape), ...overrides },
    detail,
    materials: mats,
    roleBlockNames: [mats.primary, mats.accent, mats.detail],
  }
  const model = shape.generate(ctx).finish()
  const render = buildRenderData(model)
  return { shape, model, render }
}

describe('shape generators', () => {
  it('has unique ids and at least 30 shapes', () => {
    const ids = SHAPES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(SHAPES.length).toBeGreaterThanOrEqual(30)
  })

  for (const shape of SHAPES) {
    it(`generates ${shape.name} with valid geometry`, () => {
      const t0 = performance.now()
      const { model, render } = build(shape.id, true)
      const ms = performance.now() - t0
      expect(model.dims.every((d) => d > 0 && d <= 256)).toBe(true)
      expect(model.counts.total).toBeGreaterThan(0)
      expect(model.data.length).toBe(model.dims[0] * model.dims[1] * model.dims[2])
      expect(render.blocks.length).toBe(model.counts.visible)
      expect(model.counts.total).toBe(
        model.counts.full + model.counts.bottom + model.counts.top,
      )
      expect(model.perLayer.reduce((a, l) => a + l.items, 0)).toBe(model.counts.total)
      expect(model.counts.equivalents).toBeCloseTo(model.counts.total - model.counts.slabs / 2)
      expect(ms).toBeLessThan(15000)
    })
  }

  it('uses half slabs when detail is enabled', () => {
    const { model } = build('sphere', true, { diameter: 64 })
    expect(model.counts.slabs).toBeGreaterThan(0)
    const slabStates = model.palette.filter((p) => p.kind !== 'block')
    expect(slabStates.length).toBeGreaterThan(0)
    for (const s of slabStates) {
      expect(s.name).toMatch(/_slab$/)
      expect(s.props).toEqual({ type: s.kind })
    }
  })

  it('has no slabs when detail is disabled', () => {
    const { model } = build('sphere', false, { diameter: 64 })
    expect(model.counts.slabs).toBe(0)
    expect(model.palette.every((p) => p.kind === 'block')).toBe(true)
  })

  it('produces symmetric sphere dimensions', () => {
    const { model } = build('sphere', true, { diameter: 32 })
    const [nx, ny, nz] = model.dims
    expect(nx).toBe(ny)
    expect(nx).toBe(nz)
    // The top and bottom layers of a sphere should match.
    expect(model.perLayer[0].items).toBe(model.perLayer[ny - 1].items)
  })

  it('builds the meme tower, with and without its house base', () => {
    const tower = build('dope-tower', true, { house: false }).model
    const withHouse = build('dope-tower', true, { house: true }).model
    expect(tower.dims[1]).toBeGreaterThan(tower.dims[0])
    expect(withHouse.dims[1]).toBeGreaterThan(tower.dims[1])
    expect(withHouse.counts.total).toBeGreaterThan(tower.counts.total)
    const palette = new Set(tower.palette.map((p) => p.name))
    expect(palette.has('minecraft:purple_concrete')).toBe(true)
    expect(palette.has('minecraft:amethyst_block')).toBe(true)
  })

  it('supports flat and upright torus axes', () => {
    const flat = build('torus', true, { diameter: 40, tube: 10, axis: 'y' }).model
    const uprightX = build('torus', true, { diameter: 40, tube: 10, axis: 'x' }).model
    const uprightZ = build('torus', true, { diameter: 40, tube: 10, axis: 'z' }).model
    expect(flat.dims).toEqual([40, 10, 40])
    expect(uprightX.dims).toEqual([10, 40, 40])
    expect(uprightZ.dims).toEqual([40, 40, 10])
    for (const model of [flat, uprightX, uprightZ]) {
      expect(model.counts.total).toBeGreaterThan(0)
      expect(model.perLayer[0].items).toBeGreaterThan(0)
    }
  })

  it('can hollow the sphere', () => {
    const solid = build('sphere', false, { diameter: 48, hollow: false }).model
    const hollow = build('sphere', false, { diameter: 48, hollow: true }).model
    expect(hollow.counts.total).toBeLessThan(solid.counts.total)
  })
})
