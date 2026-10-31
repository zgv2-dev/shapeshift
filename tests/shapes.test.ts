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
      expect(model.perLayer.every((l) => l.items > 0)).toBe(true)
      expect(model.dims[1]).toBe(model.perLayer.length)
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

  it('stretches the torus into an ellipse', () => {
    const ovalY = build('torus', true, { diameter: 40, tube: 10, axis: 'y', stretch: 1.8 }).model
    const ovalX = build('torus', true, { diameter: 40, tube: 10, axis: 'x', stretch: 1.8 }).model
    const ovalZ = build('torus', true, { diameter: 40, tube: 10, axis: 'z', stretch: 1.8 }).model
    expect(ovalY.dims).toEqual([72, 10, 40])
    expect(ovalX.dims).toEqual([10, 72, 40])
    expect(ovalZ.dims).toEqual([72, 40, 10])
    for (const model of [ovalY, ovalX, ovalZ]) {
      expect(model.counts.total).toBeGreaterThan(0)
    }
  })

  it('builds an open geodesic frame with optional panels and nodes', () => {
    const frame = build('geodesic', true, {}).model
    const frameNames = new Set(frame.palette.map((p) => p.name))
    expect(frameNames.has('minecraft:purple_concrete')).toBe(false)
    expect(frameNames.has('minecraft:sea_lantern')).toBe(false)

    const panelled = build('geodesic', true, { panels: true }).model
    const panelledNames = new Set(panelled.palette.map((p) => p.name))
    expect(panelledNames.has('minecraft:purple_concrete')).toBe(true)
    expect(panelledNames.has('minecraft:sea_lantern')).toBe(false)

    const lit = build('geodesic', true, { nodes: true }).model
    const litNames = new Set(lit.palette.map((p) => p.name))
    expect(litNames.has('minecraft:sea_lantern')).toBe(true)
  })

  it('keeps the igloo tunnel roof closed', () => {
    const { model } = build('igloo', true, {
      diameter: 32,
      entrance: 12,
      wall: 2,
      trim: true,
    })
    const [nx, , nz] = model.dims
    const cx = Math.floor(nx / 2)
    // A point inside the tunnel, not at the open mouth.
    const z = Math.floor(nz * 0.8)
    expect(model.data[(4 * nz + z) * nx + cx]).not.toBe(0)
  })

  it('keeps the hollow heart shell watertight', () => {
    const { model } = build('heart', true, {
      width: 32,
      height: 32,
      depth: 16,
      hollow: true,
      wall: 1,
    })
    const [nx, ny, nz] = model.dims
    const idx = (x: number, y: number, z: number) => (y * nz + z) * nx + x
    const seen = new Uint8Array(model.data.length)
    const queue: number[] = []
    const visit = (x: number, y: number, z: number) => {
      const i = idx(x, y, z)
      if (seen[i] || model.data[i] !== 0) return
      seen[i] = 1
      queue.push(i)
    }
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        visit(0, y, z)
        visit(nx - 1, y, z)
      }
    }
    for (let x = 0; x < nx; x++) {
      for (let z = 0; z < nz; z++) {
        visit(x, 0, z)
        visit(x, ny - 1, z)
      }
    }
    for (let x = 0; x < nx; x++) {
      for (let y = 0; y < ny; y++) {
        visit(x, y, 0)
        visit(x, y, nz - 1)
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head]
      const x = i % nx
      const z = Math.floor(i / nx) % nz
      const y = Math.floor(i / (nx * nz))
      if (x > 0) visit(x - 1, y, z)
      if (x + 1 < nx) visit(x + 1, y, z)
      if (y > 0) visit(x, y - 1, z)
      if (y + 1 < ny) visit(x, y + 1, z)
      if (z > 0) visit(x, y, z - 1)
      if (z + 1 < nz) visit(x, y, z + 1)
    }
    let enclosedAir = 0
    for (let i = 0; i < model.data.length; i++) {
      if (model.data[i] === 0 && !seen[i]) enclosedAir += 1
    }
    expect(enclosedAir).toBeGreaterThan(0)
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
