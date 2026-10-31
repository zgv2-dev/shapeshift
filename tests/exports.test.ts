import { describe, expect, it } from 'vitest'
import { parseUncompressed, type NBT } from 'prismarine-nbt'
import mcData from 'minecraft-data'
import { SHAPES, defaultMaterials, defaultParams } from '../src/core/shapes'
import type { GenerationContext, VoxelModel } from '../src/core/types'
import { buildBlockListCsv, buildLitematic, buildSchem, buildStructure } from '../src/core/export/builders'
import { gzipBytes } from '../src/core/export/download'
import { BLOCKS } from '../src/core/blocks'

function makeModel(detail = true): VoxelModel {
  const shape = SHAPES.find((s) => s.id === 'sphere')!
  const mats = defaultMaterials(shape)
  const ctx: GenerationContext = {
    p: { ...defaultParams(shape), diameter: 24, hollow: true, wall: 1 },
    detail,
    materials: mats,
    roleBlockNames: [mats.primary, mats.accent, mats.detail],
  }
  return shape.generate(ctx).finish()
}

function root(nbt: NBT): any {
  return nbt.value
}

interface LongPair { 0: number; 1: number }

function toBigInt(value: LongPair): bigint {
  const hi = BigInt(value[0])
  const lo = BigInt(value[1] >>> 0)
  return BigInt.asUintN(64, (hi << 32n) | lo)
}

describe('block registry', () => {
  it('uses real 1.20.1 block ids for every palette entry and slab variant', () => {
    const blocks = mcData('1.20.1').blocksArray.map((b) => b.name)
    for (const block of BLOCKS) {
      expect(blocks, block.id).toContain(block.id.replace('minecraft:', ''))
      if (block.slab) expect(blocks, block.slab).toContain(block.slab.replace('minecraft:', ''))
    }
  })
})

describe('litematic export', () => {
  it('writes a parseable region with slab states and exact block order', async () => {
    const model = makeModel()
    const parsed = await parseUncompressed(Buffer.from(buildLitematic(model)))
    const value = root(parsed)
    expect(value.MinecraftDataVersion.value).toBe(3465)
    expect(value.Version.value).toBe(6)
    const region = value.Regions.value.shapeshift.value
    expect(region.Size.value).toMatchObject({ x: { value: 24 }, y: { value: 24 }, z: { value: 24 } })

    const palette = region.BlockStatePalette.value.value as any[]
    expect(palette[0].Name.value).toBe('minecraft:air')
    expect(palette.some((p: any) => p.Properties?.value?.type?.value === 'bottom')).toBe(true)
    expect(palette.some((p: any) => p.Properties?.value?.type?.value === 'top')).toBe(true)

    const bits = Math.max(4, Math.ceil(Math.log2(palette.length)))
    const perLong = Math.floor(64 / bits)
    const longs = (region.BlockStates.value as LongPair[]).map(toBigInt)
    const total = 24 * 24 * 24
    expect(longs.length).toBe(Math.ceil(total / perLong))
    const mask = (1n << BigInt(bits)) - 1n
    let mismatches = 0
    for (let i = 0; i < total; i++) {
      const word = longs[Math.floor(i / perLong)]
      const idx = Number((word >> BigInt((i % perLong) * bits)) & mask)
      if (idx !== model.data[i]) mismatches += 1
    }
    expect(mismatches).toBe(0)
  })
})

describe('sponge schematic export', () => {
  it('stores slab block state keys and matching varint data', async () => {
    const model = makeModel()
    const parsed = await parseUncompressed(Buffer.from(buildSchem(model)))
    const value = root(parsed)
    expect(value.Version.value).toBe(2)
    expect(value.Width.value).toBe(24)
    const palette = value.Palette.value as Record<string, { value: number }>
    expect(palette['minecraft:air'].value).toBe(0)
    const keys = Object.keys(palette)
    expect(keys.some((k) => k === 'minecraft:smooth_stone_slab[type=bottom]')).toBe(true)
    expect(keys.some((k) => k === 'minecraft:smooth_stone_slab[type=top]')).toBe(true)

    const data = Uint8Array.from(value.BlockData.value as Buffer)
    const reverse = new Map<number, number>()
    for (const [key, tag] of Object.entries(palette)) reverse.set(tag.value, keys.indexOf(key))
    let i = 0
    let p = 0
    let mismatches = 0
    while (i < data.length) {
      let value = 0
      let shift = 0
      let byte = 0
      do {
        byte = data[i++]
        value |= (byte & 0x7f) << shift
        shift += 7
      } while (byte & 0x80)
      if (reverse.get(value) !== model.data[p]) mismatches += 1
      p += 1
    }
    expect(p).toBe(model.data.length)
    expect(mismatches).toBe(0)
  })
})

describe('structure block export', () => {
  it('includes every non-air block and slab properties', async () => {
    const model = makeModel()
    const parsed = await parseUncompressed(Buffer.from(buildStructure(model)))
    const value = root(parsed)
    expect(value.size.value.value).toEqual([24, 24, 24])
    const blocks = value.blocks.value.value as any[]
    expect(blocks.length).toBe(model.counts.total)
    const palette = value.palette.value.value as any[]
    expect(palette.some((p: any) => p.Properties?.value?.type?.value === 'top')).toBe(true)
    expect(palette.every((p: any) => p.Name.value !== 'minecraft:air')).toBe(true)
  })
})

describe('gzip + csv', () => {
  it('gzips a litematic into a parseable file', async () => {
    const model = makeModel()
    const gz = await gzipBytes(buildLitematic(model))
    expect(gz[0]).toBe(0x1f)
    expect(gz[1]).toBe(0x8b)
    const parsed = await parseUncompressed(await gunzip(gz))
    expect(root(parsed).Version.value).toBe(6)
  })

  it('counts full blocks and slabs separately in the CSV', () => {
    const model = makeModel()
    const csv = buildBlockListCsv(model)
    expect(csv).toContain('TOTAL')
    expect(csv).toContain('_slab')
  })
})

async function gunzip(data: Uint8Array): Promise<Buffer> {
  const ds = new DecompressionStream('gzip')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return Buffer.from(await new Response(stream).arrayBuffer())
}
