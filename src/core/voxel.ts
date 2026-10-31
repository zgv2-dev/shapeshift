import { getBlock, slabFor } from './blocks'
import type { BlockState, GenerationContext, LayerStat, VoxelModel } from './types'

export interface BuilderOptions {
  detail: boolean
  roleBlockNames: [string, string, string]
}

export interface RenderCell {
  x: number
  y: number
  z: number
  kind: 0 | 1 | 2
  palette: number
}

/**
 * A voxel canvas with optional half-block vertical resolution.
 *
 * Shapes write to two half-cell layers per block. A cell can end up as a full
 * block, a bottom slab, a top slab or air. This is what makes the curved
 * silhouettes noticeably smoother than a full-block-only generator.
 */
export class VoxelBuilder {
  readonly nx: number
  readonly ny: number
  readonly nz: number
  readonly detail: boolean
  readonly roleBlockNames: [string, string, string]
  /** Low byte = bottom-half role, high byte = top-half role. 0 = empty. */
  private cells: Uint16Array

  constructor(nx: number, ny: number, nz: number, opts: BuilderOptions) {
    this.nx = Math.max(1, Math.min(256, Math.round(nx)))
    this.ny = Math.max(1, Math.min(256, Math.round(ny)))
    this.nz = Math.max(1, Math.min(256, Math.round(nz)))
    this.detail = opts.detail
    this.roleBlockNames = opts.roleBlockNames
    this.cells = new Uint16Array(this.nx * this.ny * this.nz)
  }

  index(x: number, y: number, z: number): number {
    return (y * this.nz + z) * this.nx + x
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz
  }

  setHalf(x: number, y: number, z: number, half: 0 | 1, role: number): void {
    if (!this.inBounds(x, y, z) || role <= 0) return
    const i = this.index(x, y, z)
    const cur = this.cells[i]
    this.cells[i] = half === 0 ? (cur & 0xff00) | (role & 0xff) : (cur & 0x00ff) | ((role & 0xff) << 8)
  }

  setFull(x: number, y: number, z: number, role: number): void {
    if (!this.inBounds(x, y, z) || role <= 0) return
    this.cells[this.index(x, y, z)] = (role & 0xff) | ((role & 0xff) << 8)
  }

  clear(x: number, y: number, z: number): void {
    if (!this.inBounds(x, y, z)) return
    this.cells[this.index(x, y, z)] = 0
  }

  getCell(x: number, y: number, z: number): { bottom: number; top: number } {
    if (!this.inBounds(x, y, z)) return { bottom: 0, top: 0 }
    const v = this.cells[this.index(x, y, z)]
    return { bottom: v & 0xff, top: (v >> 8) & 0xff }
  }

  bottomAt(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0
    return this.cells[this.index(x, y, z)] & 0xff
  }

  topAt(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0
    return (this.cells[this.index(x, y, z)] >> 8) & 0xff
  }

  fillBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, role: number): void {
    const ax = Math.max(0, Math.min(x0, x1))
    const bx = Math.min(this.nx - 1, Math.max(x0, x1))
    const ay = Math.max(0, Math.min(y0, y1))
    const by = Math.min(this.ny - 1, Math.max(y0, y1))
    const az = Math.max(0, Math.min(z0, z1))
    const bz = Math.min(this.nz - 1, Math.max(z0, z1))
    for (let y = ay; y <= by; y++) {
      for (let z = az; z <= bz; z++) {
        for (let x = ax; x <= bx; x++) this.setFull(x, y, z, role)
      }
    }
  }

  /** Fill a full block column, handy for walls and poles. */
  column(x: number, z: number, y0: number, y1: number, role: number): void {
    this.fillBox(x, y0, z, x, y1, z, role)
  }

  /** Rasterise a continuous inside-test, sampling twice vertically when enabled. */
  rasterize(test: (x: number, y: number, z: number) => number): void {
    const { nx, ny, nz } = this
    for (let z = 0; z < nz; z++) {
      const cz = z + 0.5
      for (let x = 0; x < nx; x++) {
        const cx = x + 0.5
        for (let y = 0; y < ny; y++) {
          if (this.detail) {
            const b = test(cx, y + 0.25, cz)
            if (b > 0) this.setHalf(x, y, z, 0, b)
            const t = test(cx, y + 0.75, cz)
            if (t > 0) this.setHalf(x, y, z, 1, t)
          } else {
            const r = test(cx, y + 0.5, cz)
            if (r > 0) this.setFull(x, y, z, r)
          }
        }
      }
    }
  }

  /** Stamp an ellipsoid, sampling half-cells so concave curves look smooth. */
  stampEllipsoid(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    role: number,
    hollowRadius = 0,
  ): void {
    const x0 = Math.max(0, Math.floor(cx - rx))
    const x1 = Math.min(this.nx - 1, Math.ceil(cx + rx))
    const y0 = Math.max(0, Math.floor(cy - ry))
    const y1 = Math.min(this.ny - 1, Math.ceil(cy + ry))
    const z0 = Math.max(0, Math.floor(cz - rz))
    const z1 = Math.min(this.nz - 1, Math.ceil(cz + rz))
    const inner = hollowRadius > 0
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        const dz = (z + 0.5 - cz) / rz
        for (let x = x0; x <= x1; x++) {
          const dx = (x + 0.5 - cx) / rx
          const q = dx * dx + dz * dz
          if (q > 1) continue
          const samples: [number, number][] = this.detail
            ? [
                [0, y + 0.25],
                [1, y + 0.75],
              ]
            : [[-1, y + 0.5]]
          for (const [half, sy] of samples) {
            const dy = (sy - cy) / ry
            const d = q + dy * dy
            if (d > 1) continue
            if (inner) {
              const di = dx * dx + dz * dz + ((sy - cy) / Math.max(0.001, ry - hollowRadius)) ** 2
              if (di < 1) continue
            }
            if (half < 0) this.setFull(x, y, z, role)
            else this.setHalf(x, y, z, half as 0 | 1, role)
          }
        }
      }
    }
  }

  /** Stamp a ball (uses ellipsoid helper). */
  stampBall(cx: number, cy: number, cz: number, r: number, role: number): void {
    this.stampEllipsoid(cx, cy, cz, r, r, r, role)
  }

  /** Stamp a chain of balls along a 3D line. */
  stampLine(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    r: number,
    role: number,
    step = 0.45,
  ): void {
    const dx = x1 - x0
    const dy = y1 - y0
    const dz = z1 - z0
    const len = Math.hypot(dx, dy, dz)
    const n = Math.max(1, Math.ceil(len / step))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      this.stampBall(x0 + dx * t, y0 + dy * t, z0 + dz * t, r, role)
    }
  }

  /** Iterate every written cell. */
  forEachWritten(fn: (x: number, y: number, z: number, bottom: number, top: number) => void): void {
    const { nx, ny, nz } = this
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        const row = (y * nz + z) * nx
        for (let x = 0; x < nx; x++) {
          const v = this.cells[row + x]
          if (v !== 0) fn(x, y, z, v & 0xff, (v >> 8) & 0xff)
        }
      }
    }
  }

  finish(): VoxelModel {
    const { nx, ny, nz } = this
    const data = new Uint8Array(nx * ny * nz)
    const palette: BlockState[] = [{ name: 'minecraft:air', kind: 'block' }]
    const paletteIndex = new Map<string, number>()

    const perLayer: LayerStat[] = Array.from({ length: ny }, () => ({
      items: 0,
      equivalents: 0,
      full: 0,
      slabs: 0,
    }))

    let total = 0
    let full = 0
    let bottom = 0
    let top = 0

    const stateFor = (role: number, kind: 'block' | 'bottom' | 'top'): BlockState => {
      const blockName = this.roleBlockNames[Math.max(0, Math.min(2, role - 1))] ?? this.roleBlockNames[0]
      const def = getBlock(blockName)
      if (kind === 'block') {
        return { name: blockName, kind: 'block', color: def.color, transparent: def.transparent }
      }
      const slab = slabFor(blockName)
      if (!slab) return { name: blockName, kind: 'block', color: def.color, transparent: def.transparent }
      return {
        name: slab,
        kind,
        props: { type: kind === 'bottom' ? 'bottom' : 'top' },
        color: def.color,
        transparent: def.transparent,
      }
    }

    const addPalette = (role: number, kind: 'block' | 'bottom' | 'top'): number => {
      const state = stateFor(role, kind)
      const key = `${state.name}|${state.kind}|${JSON.stringify(state.props ?? {})}`
      const found = paletteIndex.get(key)
      if (found !== undefined) return found
      const idx = palette.length
      palette.push(state)
      paletteIndex.set(key, idx)
      return idx
    }

    this.forEachWritten((x, y, z, bRole, tRole) => {
      let kind: 'block' | 'bottom' | 'top'
      let role: number
      if (bRole && tRole) {
        kind = 'block'
        role = bRole
      } else if (bRole) {
        kind = 'bottom'
        role = bRole
        if (!this.detail || !slabFor(this.roleBlockNames[role - 1])) kind = 'block'
      } else {
        kind = 'top'
        role = tRole
        if (!this.detail || !slabFor(this.roleBlockNames[role - 1])) kind = 'block'
      }

      const actual: 'block' | 'bottom' | 'top' = kind === 'block' ? 'block' : kind
      const idx = addPalette(role, actual)
      data[this.index(x, y, z)] = idx

      const layer = perLayer[y]
      layer.items += 1
      if (actual === 'block') {
        full += 1
        layer.full += 1
        layer.equivalents += 1
      } else {
        if (actual === 'bottom') bottom += 1
        else top += 1
        layer.slabs += 1
        layer.equivalents += 0.5
      }
      total += 1
    })

    const slabs = bottom + top
    const equivalents = total - slabs * 0.5

    // Cull fully enclosed blocks for rendering.
    let visible = 0
    const isOpaqueFull = (x: number, y: number, z: number): boolean => {
      if (!this.inBounds(x, y, z)) return false
      const idx = data[this.index(x, y, z)]
      if (idx === 0) return false
      const state = palette[idx]
      return state.kind === 'block' && !state.transparent
    }
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        for (let x = 0; x < nx; x++) {
          const idx = data[this.index(x, y, z)]
          if (idx === 0) continue
          const state = palette[idx]
          if (
            state.kind === 'block' &&
            !state.transparent &&
            isOpaqueFull(x + 1, y, z) &&
            isOpaqueFull(x - 1, y, z) &&
            isOpaqueFull(x, y + 1, z) &&
            isOpaqueFull(x, y - 1, z) &&
            isOpaqueFull(x, y, z + 1) &&
            isOpaqueFull(x, y, z - 1)
          ) {
            continue
          }
          visible += 1
        }
      }
    }

    return {
      dims: [nx, ny, nz],
      data,
      palette,
      perLayer,
      counts: {
        total,
        full,
        bottom,
        top,
        slabs,
        equivalents,
        stacks: Math.ceil(total / 64),
        visible,
        paletteCount: palette.length,
      },
    }
  }
}

/** Convenience: build a model and clean up repeated role defaults. */
export function builderFor(
  ctx: GenerationContext,
  nx: number,
  ny: number,
  nz: number,
): VoxelBuilder {
  return new VoxelBuilder(nx, ny, nz, {
    detail: ctx.detail,
    roleBlockNames: ctx.roleBlockNames,
  })
}
