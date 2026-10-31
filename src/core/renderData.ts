import type { VoxelModel } from './types'

export const KIND_BLOCK = 0
export const KIND_BOTTOM = 1
export const KIND_TOP = 2

export interface RenderData {
  blocks: Uint32Array
  visible: number
}

/**
 * Pack only the blocks that are visible from outside. Fully enclosed blocks are
 * invisible in an opaque voxel model, so dropping them makes big shells much
 * cheaper to draw.
 *
 * Layout: x | y << 8 | z << 16 | kind << 24 | palette << 26.
 */
export function buildRenderData(model: VoxelModel): RenderData {
  const [nx, ny, nz] = model.dims
  const { data, palette } = model
  const out = new Uint32Array(model.counts.visible)
  let n = 0

  const idx = (x: number, y: number, z: number): number => (y * nz + z) * nx + x
  const isOpaqueFull = (x: number, y: number, z: number): boolean => {
    if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return false
    const p = data[idx(x, y, z)]
    if (p === 0) return false
    const state = palette[p]
    return state.kind === 'block' && !state.transparent
  }

  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const p = data[idx(x, y, z)]
        if (p === 0) continue
        const state = palette[p]
        let kind = 0
        if (state.kind === 'bottom') kind = 1
        else if (state.kind === 'top') kind = 2
        if (
          kind === 0 &&
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
        out[n++] =
          (x & 0xff) |
          ((y & 0xff) << 8) |
          ((z & 0xff) << 16) |
          ((kind & 0x3) << 24) |
          ((p & 0x3f) << 26)
      }
    }
  }

  return { blocks: n === out.length ? out : out.subarray(0, n), visible: n }
}

