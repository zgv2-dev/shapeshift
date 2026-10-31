import type { BlockState, VoxelModel } from '../types'
import { TAG, blockStateKey, nbt, writeNbt, type NbtTag } from './nbt'

import { SCHEMATIC_DATA_VERSION } from '../versions'

const MC_DATA_VERSION = SCHEMATIC_DATA_VERSION

function paletteTag(state: BlockState) {
  const entry: Record<string, NbtTag> = {
    Name: nbt.string(state.name),
  }
  if (state.props && Object.keys(state.props).length > 0) {
    const props: Record<string, NbtTag> = {}
    for (const [k, v] of Object.entries(state.props)) props[k] = nbt.string(v)
    entry.Properties = nbt.compound(props)
  }
  return nbt.compound(entry)
}

function nowLong(): bigint {
  return BigInt(Date.now())
}

/**
 * Litematica schematic. BlockStates are packed LSB-first into 64-bit longs,
 * with x-fastest ordering (x + z * width + y * width * length).
 */
export function buildLitematic(model: VoxelModel, name = 'Shapeshift'): Uint8Array {
  const [nx, ny, nz] = model.dims
  const total = nx * ny * nz
  const paletteLen = model.palette.length
  const bits = Math.max(4, Math.ceil(Math.log2(Math.max(2, paletteLen))))
  const perLong = Math.floor(64 / bits)
  const longCount = Math.ceil(total / perLong)
  const packed = new BigInt64Array(longCount)
  for (let i = 0; i < total; i++) {
    const v = model.data[i]
    if (v === 0) continue
    const li = (i / perLong) | 0
    packed[li] |= BigInt(v) << BigInt((i % perLong) * bits)
  }

  const region = nbt.compound({
    Position: nbt.compound({
      x: nbt.int(-Math.floor(nx / 2)),
      y: nbt.int(0),
      z: nbt.int(-Math.floor(nz / 2)),
    }),
    Size: nbt.compound({ x: nbt.int(nx), y: nbt.int(ny), z: nbt.int(nz) }),
    BlockStatePalette: nbt.list(TAG.compound, model.palette.map(paletteTag)),
    BlockStates: nbt.longArray(packed),
    Entities: nbt.list(TAG.compound, []),
    TileEntities: nbt.list(TAG.compound, []),
    PendingBlockTicks: nbt.list(TAG.compound, []),
    PendingFluidTicks: nbt.list(TAG.compound, []),
  })

  const root = nbt.compound({
    MinecraftDataVersion: nbt.int(MC_DATA_VERSION),
    Version: nbt.int(6),
    Metadata: nbt.compound({
      Name: nbt.string(name),
      Author: nbt.string('Shapeshift'),
      Description: nbt.string('Generated with Shapeshift — minecraft shape studio'),
      RegionCount: nbt.int(1),
      TotalVolume: nbt.long(BigInt(total)),
      TotalBlocks: nbt.long(BigInt(model.counts.total)),
      TimeCreated: nbt.long(nowLong()),
      TimeModified: nbt.long(nowLong()),
      EnclosingSize: nbt.compound({ x: nbt.int(nx), y: nbt.int(ny), z: nbt.int(nz) }),
    }),
    Regions: nbt.compound({ shapeshift: region }),
  })
  return writeNbt(root)
}

function writeVarInt(out: Uint8Sink, value: number): void {
  let v = value
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  out.push(v)
}

class Uint8Sink {
  private buf = new Uint8Array(1024)
  len = 0
  push(byte: number): void {
    if (this.len === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2)
      next.set(this.buf)
      this.buf = next
    }
    this.buf[this.len++] = byte
  }
  finish(): Uint8Array {
    return this.buf.slice(0, this.len)
  }
}

/** Sponge schematic v2, as used by WorldEdit, FAWE and Amulet. */
export function buildSchem(model: VoxelModel, name = 'Shapeshift'): Uint8Array {
  const [nx, ny, nz] = model.dims
  const palette: Record<string, ReturnType<typeof nbt.int>> = {}
  model.palette.forEach((state, i) => {
    palette[blockStateKey(state.name, state.props)] = nbt.int(i)
  })

  const sink = new Uint8Sink()
  for (let i = 0; i < model.data.length; i++) writeVarInt(sink, model.data[i])

  const root = nbt.compound({
    Version: nbt.int(2),
    DataVersion: nbt.int(MC_DATA_VERSION),
    Width: nbt.int(nx),
    Height: nbt.int(ny),
    Length: nbt.int(nz),
    Offset: nbt.intArray([-Math.floor(nx / 2), 0, -Math.floor(nz / 2)]),
    PaletteMax: nbt.int(model.palette.length),
    Palette: nbt.compound(palette),
    BlockData: nbt.byteArray(sink.finish()),
    BlockEntities: nbt.list(TAG.compound, []),
    Entities: nbt.list(TAG.compound, []),
    Metadata: nbt.compound({
      Name: nbt.string(name),
      Author: nbt.string('Shapeshift'),
    }),
  })
  return writeNbt(root)
}

/** Vanilla structure block NBT (size / palette / blocks). */
export function buildStructure(model: VoxelModel): Uint8Array {
  const [nx, ny, nz] = model.dims
  const used: number[] = []
  const remap = new Map<number, number>()
  for (let i = 0; i < model.data.length; i++) {
    const p = model.data[i]
    if (p === 0 || remap.has(p)) continue
    remap.set(p, used.length)
    used.push(p)
  }

  const palette = used.map((p) => paletteTag(model.palette[p]))
  const blocks: ReturnType<typeof nbt.compound>[] = []
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const p = model.data[(y * nz + z) * nx + x]
        if (p === 0) continue
        const state = remap.get(p)
        if (state === undefined) continue
        blocks.push(
          nbt.compound({
            pos: nbt.list(TAG.int, [nbt.int(x), nbt.int(y), nbt.int(z)]),
            state: nbt.int(state),
          }),
        )
      }
    }
  }

  const root = nbt.compound({
    DataVersion: nbt.int(MC_DATA_VERSION),
    size: nbt.list(TAG.int, [nbt.int(nx), nbt.int(ny), nbt.int(nz)]),
    palette: nbt.list(TAG.compound, palette),
    blocks: nbt.list(TAG.compound, blocks),
    entities: nbt.list(TAG.compound, []),
  })
  return writeNbt(root)
}

export function buildBlockListCsv(model: VoxelModel): string {
  const counts = new Map<number, number>()
  for (let i = 0; i < model.data.length; i++) {
    const p = model.data[i]
    if (p === 0) continue
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  const rows = ['block,state,count,full_block_equivalents']
  for (const [index, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const state = model.palette[index]
    const key = blockStateKey(state.name, state.props).replace(/"/g, '""')
    const eq = state.kind === 'block' ? count : count * 0.5
    rows.push(`"${key}","${state.kind}",${count},${eq}`)
  }
  rows.push(`"TOTAL","all",${model.counts.total},${model.counts.equivalents}`)
  return rows.join('\n') + '\n'
}

export function buildCoordinatesCsv(
  model: VoxelModel,
  origin: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): string {
  const [nx, ny, nz] = model.dims
  const rows = ['x,y,z,block,state']
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const p = model.data[(y * nz + z) * nx + x]
        if (p === 0) continue
        const state = model.palette[p]
        rows.push(
          `${origin.x + x - Math.floor(nx / 2)},${origin.y + y},${origin.z + z - Math.floor(nz / 2)},${blockStateKey(state.name, state.props)},${state.kind}`,
        )
      }
    }
  }
  return rows.join('\n') + '\n'
}

export const EXPORT_DATA_VERSION = MC_DATA_VERSION
