import type { ShapeDef } from '../types'
import { builderFor, type VoxelBuilder } from '../voxel'
import {
  R_ACCENT,
  R_DETAIL,
  R_PRIMARY,
  boolParam,
  clamp,
  flag,
  intParam,
  num,
  roles,
  shapeMeta,
} from './util'


function carveTowerDoor(
  b: VoxelBuilder,
  cx: number,
  cz: number,
  wall: number,
  radiusAt: (y: number) => number,
  height: number,
  width: number,
): void {
  for (let y = 0; y < height; y++) {
    const r = radiusAt(y)
    let half = width / 2
    if (y >= height - 2) half = Math.max(1, width / 2 - (y - (height - 2)) * 0.9)
    const x0 = Math.max(0, Math.floor(cx - half - 1))
    const x1 = Math.min(b.nx - 1, Math.ceil(cx + half + 1))
    const z0 = Math.max(0, Math.floor(cz + r - wall - 2))
    const z1 = Math.min(b.nz - 1, Math.ceil(cz + r + 1))
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx
        const dz = z + 0.5 - cz
        if (dz <= 0 || Math.abs(dx) > half) continue
        const rho = Math.hypot(dx, dz)
        if (rho >= r - wall - 1 && rho <= r + 1) b.clear(x, y, z)
        if (y === 0 && rho <= r) b.clear(x, y, z)
      }
    }
  }
}

function observatory(): ShapeDef {
  return shapeMeta(
    'observatory',
    'Observatory',
    'structures',
    'A domed base with a viewing slit and door.',
    'A cylindrical base with a hollow dome, an arched doorway and a vertical viewing slit. The platform is ready for a telescope of your own.',
    [
      intParam('diameter', 'Base diameter', 32, 12, 128, { group: 'Dimensions' }),
      intParam('base', 'Base height', 12, 4, 80),
      intParam('dome', 'Dome height', 18, 6, 80),
      intParam('wall', 'Wall thickness', 2, 1, 6, { group: 'Style' }),
      intParam('door', 'Door width', 4, 2, 12, { group: 'Details' }),
      intParam('doorH', 'Door height', 5, 2, 12, { group: 'Details' }),
      intParam('slit', 'Viewing slit', 5, 0, 24, { group: 'Details' }),
      boolParam('telescope', 'Telescope', true, { group: 'Details' }),
    ],
    roles(
      ['primary', 'Walls & dome', 'minecraft:smooth_stone'],
      ['accent', 'Trim', 'minecraft:cut_copper'],
      ['detail', 'Telescope', 'minecraft:gold_block'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 12, 128)
      const baseH = clamp(num(ctx, 'base'), 4, 80)
      const domeH = clamp(num(ctx, 'dome'), 6, 80)
      const wall = clamp(num(ctx, 'wall'), 1, 6)
      const doorW = clamp(num(ctx, 'door'), 2, 12)
      const doorH = clamp(num(ctx, 'doorH'), 2, 12)
      const slit = clamp(num(ctx, 'slit'), 0, 24)
      const telescope = flag(ctx, 'telescope')
      const totalH = baseH + domeH
      const b = builderFor(ctx, d, totalH, d)
      const c = d / 2
      const R = d / 2
      const ri = Math.max(0.5, R - wall)

      // base shell + floor
      for (let y = 0; y < baseH; y++) {
        for (let z = 0; z < d; z++) {
          for (let x = 0; x < d; x++) {
            const rho = Math.hypot(x + 0.5 - c, z + 0.5 - c)
            if (rho <= R && rho >= ri) b.setFull(x, y, z, R_PRIMARY)
            if (y === 0 && rho < ri) b.setFull(x, y, z, R_PRIMARY)
            if (y === baseH - 1 && rho < ri) b.setFull(x, y, z, R_PRIMARY)
          }
        }
      }

      // dome shell with slab-friendly sampling
      const innerRx = Math.max(0.5, R - wall)
      const innerRy = Math.max(0.5, domeH - wall)
      for (let y = baseH; y < totalH; y++) {
        const samples = b.detail ? [0.25, 0.75] : [0.5]
        for (const sy of samples) {
          const yy = (y + sy - baseH) / domeH
          if (yy < 0 || yy > 1) continue
          for (let z = 0; z < d; z++) {
            for (let x = 0; x < d; x++) {
              const dx = (x + 0.5 - c) / R
              const dz = (z + 0.5 - c) / R
              if (dx * dx + yy * yy + dz * dz > 1) continue
              const mx = (x + 0.5 - c) / innerRx
              const my = (y + sy - baseH) / innerRy
              const mz = (z + 0.5 - c) / innerRx
              if (mx * mx + my * my + mz * mz < 1) continue
              if (b.detail) b.setHalf(x, y, z, sy < 0.5 ? 0 : 1, R_PRIMARY)
              else b.setFull(x, y, z, R_PRIMARY)
            }
          }
        }
      }

      // trim ring at the spring line
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < d; x++) {
          const rho = Math.hypot(x + 0.5 - c, z + 0.5 - c)
          if (rho <= R && rho >= R - 1.2) {
            b.setFull(x, baseH - 1, z, R_ACCENT)
          }
        }
      }

      // arched doorway through the base
      carveTowerDoor(b, c, c, wall, () => R, doorH, doorW)

      // viewing slit through the front of the dome
      if (slit > 0) {
        for (let y = baseH; y < totalH; y++) {
          for (let z = 0; z < d; z++) {
            for (let x = 0; x < d; x++) {
              if (
                Math.abs(x + 0.5 - c) < slit / 2 &&
                z + 0.5 - c > 0 &&
                y >= baseH
              ) {
                b.clear(x, y, z)
              }
            }
          }
        }
      }

      // a little telescope aimed through the slit
      if (telescope) {
        const startY = baseH + 2
        const endY = baseH + domeH * 0.58
        const endZ = c + R * 0.6
        b.stampBall(c, baseH + 1, c, 2.2, R_DETAIL)
        b.stampLine(c, startY, c, c, endY, endZ, 1.1, R_DETAIL, 0.4)
        b.stampBall(c, endY, endZ, 1.9, R_DETAIL)
      }

      return b
    },
  )
}

function wizardTower(): ShapeDef {
  return shapeMeta(
    'wizard-tower',
    'Wizard tower',
    'structures',
    'A round tower with floors, windows and a tall roof.',
    'A cylindrical tower with stacked floors, glazed windows, a conical roof and an optional attached side tower. The classic wizard’s spire, generated in one click.',
    [
      intParam('diameter', 'Tower diameter', 24, 10, 96, { group: 'Dimensions' }),
      intParam('height', 'Tower height', 64, 16, 180, { group: 'Dimensions' }),
      intParam('roof', 'Roof height', 28, 6, 64, { group: 'Dimensions' }),
      intParam('floors', 'Floors', 3, 1, 10, { group: 'Style' }),
      boolParam('windows', 'Windows', true, { group: 'Style' }),
      boolParam('side', 'Side tower', true, { group: 'Style' }),
    ],
    roles(
      ['primary', 'Stonework', 'minecraft:deepslate_bricks'],
      ['accent', 'Windows', 'minecraft:glass'],
      ['detail', 'Roof', 'minecraft:dark_oak_planks'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 10, 96)
      const h = clamp(num(ctx, 'height'), 16, 180)
      const roofH = clamp(num(ctx, 'roof'), 6, 64)
      const floors = Math.round(clamp(num(ctx, 'floors'), 1, 10))
      const windows = flag(ctx, 'windows')
      const side = flag(ctx, 'side')
      const wall = 2
      const sideD = side ? Math.max(8, Math.round(d * 0.62)) : 0
      const dimsX = side ? d + sideD - 2 : d
      const dimsZ = d
      const sideH = side ? Math.round(h * 0.62) : 0
      const sideRoof = side ? Math.round(roofH * 0.7) : 0
      const totalH = Math.max(h + roofH, sideH + sideRoof)
      const b = builderFor(ctx, dimsX, totalH, dimsZ)
      const cxm = d / 2
      const cz = d / 2
      const R = d / 2
      const rSide = sideD / 2
      const cxSide = side ? dimsX - rSide - 1 : cxm

      const body = (cx: number, cz0: number, radius: number, top: number): void => {
        for (let y = 0; y < top; y++) {
          for (let z = 0; z < b.nz; z++) {
            for (let x = 0; x < b.nx; x++) {
              const rho = Math.hypot(x + 0.5 - cx, z + 0.5 - cz0)
              if (rho <= radius && rho >= Math.max(0.4, radius - wall)) {
                b.setFull(x, y, z, R_PRIMARY)
              }
            }
          }
        }
      }

      body(cxm, cz, R, h)
      if (side) body(cxSide, cz, rSide, sideH)

      // floor plates
      for (let f = 1; f < floors; f++) {
        const fy = Math.round((h / floors) * f)
        for (let z = 0; z < d; z++) {
          for (let x = 0; x < d; x++) {
            if (Math.hypot(x + 0.5 - cxm, z + 0.5 - cz) < R - wall) b.setFull(x, fy, z, R_PRIMARY)
          }
        }
      }

      // glazed windows on each floor at the four cardinal points
      if (windows) {
        for (let f = 0; f < floors; f++) {
          const wy = Math.round((h / floors) * f + (h / floors) * 0.5)
          for (let y = wy; y <= wy + 1; y++) {
            if (y >= h) continue
            for (let z = 0; z < dimsZ; z++) {
              for (let x = 0; x < b.nx; x++) {
                const dx = x + 0.5 - cxm
                const dz = z + 0.5 - cz
                const rho = Math.hypot(dx, dz)
                if (rho < R - wall - 0.8 || rho > R + 0.6) continue
                const theta = Math.atan2(dz, dx)
                for (let i = 0; i < 4; i++) {
                  let diff = theta - (i * Math.PI) / 2
                  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
                  if (Math.abs(diff) < 0.24) {
                    b.setFull(x, y, z, R_ACCENT)
                    break
                  }
                }
              }
            }
          }
        }
      }

      // arched door
      carveTowerDoor(b, cxm, cz, wall, () => R, 5, 4)

      // roofs
      const roof = (cx: number, cz0: number, radius: number, from: number, height: number): void => {
        for (let y = from; y < from + height; y++) {
          const t = (y - from) / height
          const r = (radius + 1.6) * (1 - t)
          if (r <= 0) continue
          for (let z = 0; z < b.nz; z++) {
            for (let x = 0; x < b.nx; x++) {
              if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz0) <= r) {
                b.setFull(x, y, z, R_DETAIL)
              }
            }
          }
        }
      }
      roof(cxm, cz, R, h, roofH)
      if (side) roof(cxSide, cz, rSide, sideH, sideRoof)

      return b
    },
  )
}

function lighthouse(): ShapeDef {
  return shapeMeta(
    'lighthouse',
    'Lighthouse',
    'structures',
    'A tapered tower with stripes, gallery and lantern.',
    'A classic striped lighthouse with a walkable gallery, glazed lantern room and conical roof. The stripe spacing is adjustable, including no stripes at all.',
    [
      intParam('diameter', 'Base diameter', 22, 10, 96, { group: 'Dimensions' }),
      intParam('height', 'Tower height', 64, 12, 160, { group: 'Dimensions' }),
      intParam('taper', 'Taper', 0.28, 0, 0.6, { step: 0.02, group: 'Style' }),
      intParam('lantern', 'Lantern height', 8, 3, 24, { group: 'Details' }),
      intParam('roof', 'Roof height', 10, 3, 32, { group: 'Details' }),
      intParam('stripe', 'Stripe spacing', 6, 0, 24, { group: 'Details' }),
      boolParam('gallery', 'Gallery deck', true, { group: 'Style' }),
    ],
    roles(
      ['primary', 'Tower', 'minecraft:quartz_block'],
      ['accent', 'Stripes & roof', 'minecraft:red_terracotta'],
      ['detail', 'Lantern glass', 'minecraft:glass'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 10, 96)
      const h = clamp(num(ctx, 'height'), 12, 160)
      const taper = clamp(num(ctx, 'taper'), 0, 0.6)
      const lantern = clamp(num(ctx, 'lantern'), 3, 24)
      const roofH = clamp(num(ctx, 'roof'), 3, 32)
      const stripe = clamp(num(ctx, 'stripe'), 0, 24)
      const gallery = flag(ctx, 'gallery')
      const R = d / 2
      const R1 = Math.max(1.5, R * (1 - taper))
      const outer = Math.max(R, R1 + 2) + 1.5
      const dims = Math.ceil(outer * 2)
      const totalH = h + lantern + roofH + 2
      const b = builderFor(ctx, dims, totalH, dims)
      const c = dims / 2
      const wall = 2

      for (let y = 0; y < h; y++) {
        const r = R + (R1 - R) * (y / h)
        const trimmed = stripe > 0 && Math.floor(y / stripe) % 2 === 1
        for (let z = 0; z < dims; z++) {
          for (let x = 0; x < dims; x++) {
            const rho = Math.hypot(x + 0.5 - c, z + 0.5 - c)
            if (rho <= r && rho >= Math.max(0.5, r - wall)) {
              b.setFull(x, y, z, trimmed ? R_ACCENT : R_PRIMARY)
            }
          }
        }
      }

      // arched door in the tapered base
      carveTowerDoor(b, c, c, wall, (yy) => R + (R1 - R) * (yy / h), 4, 4)

      // gallery deck and railing
      if (gallery) {
        for (let z = 0; z < dims; z++) {
          for (let x = 0; x < dims; x++) {
            const rho = Math.hypot(x + 0.5 - c, z + 0.5 - c)
            if (rho <= R1 + 2) b.setFull(x, h, z, R_PRIMARY)
            if (rho <= R1 + 2 && rho >= R1 + 1) {
              b.setFull(x, h + 1, z, R_ACCENT)
              b.setFull(x, h + 2, z, R_ACCENT)
            }
          }
        }
      }

      // lantern room
      const ly0 = h + (gallery ? 1 : 0)
      for (let y = ly0; y < ly0 + lantern; y++) {
        for (let z = 0; z < dims; z++) {
          for (let x = 0; x < dims; x++) {
            const rho = Math.hypot(x + 0.5 - c, z + 0.5 - c)
            if (rho <= R1 && rho >= Math.max(0.5, R1 - 1)) {
              b.setFull(x, y, z, R_DETAIL)
            }
          }
        }
      }
      // central lamp
      const lampY = Math.floor(ly0 + lantern / 2)
      for (let y = lampY - 1; y <= lampY + 1; y++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            b.setFull(Math.floor(c) + dx, y, Math.floor(c) + dz, R_ACCENT)
          }
        }
      }

      // roof cone
      const roofBase = ly0 + lantern
      for (let y = roofBase; y < roofBase + roofH; y++) {
        const t = (y - roofBase) / roofH
        const r = (R1 + 1.6) * (1 - t)
        if (r <= 0) continue
        for (let z = 0; z < dims; z++) {
          for (let x = 0; x < dims; x++) {
            if (Math.hypot(x + 0.5 - c, z + 0.5 - c) <= r) b.setFull(x, y, z, R_ACCENT)
          }
        }
      }

      return b
    },
  )
}

function dopeTower(): ShapeDef {
  return shapeMeta(
    'dope-tower',
    'Dope wizard tower',
    'structures',
    'The house-topping meme spire.',
    'A fluted light-stone shaft crowned by a jagged, tiered purple spire — the “put a wizard tower on your house” meme. The House base is on by default; turn it off to drop just the tower onto your own build.',
    [
      intParam('diameter', 'Shaft diameter', 6, 4, 16, { group: 'Dimensions' }),
      intParam('base', 'Shaft height', 14, 3, 24),
      intParam('height', 'Spire height', 44, 16, 80),
      intParam('tiers', 'Spire tiers', 5, 3, 9, { group: 'Style' }),
      intParam('flare', 'Tier flare', 3, 1, 4, { group: 'Style' }),
      intParam('top', 'Needle height', 10, 3, 20, { group: 'Dimensions' }),
      intParam('wall', 'Spire wall', 1, 1, 3, { group: 'Style' }),
      boolParam('windows', 'Glow windows', true, { group: 'Details' }),
      boolParam('spikes', 'Jagged rims', true, { group: 'Details' }),
      boolParam('house', 'House base', true, { group: 'Details' }),
    ],
    roles(
      ['primary', 'Shaft & house', 'minecraft:smooth_stone'],
      ['accent', 'Purple spire', 'minecraft:purple_concrete'],
      ['detail', 'Amethyst glow', 'minecraft:amethyst_block'],
    ),
    (ctx) => {
      const shaftD = clamp(num(ctx, 'diameter'), 4, 16)
      const shaftR = shaftD / 2
      const baseH = clamp(num(ctx, 'base'), 3, 24)
      const spireH = clamp(num(ctx, 'height'), 16, 80)
      const tiers = Math.round(clamp(num(ctx, 'tiers'), 3, 9))
      const flare = clamp(num(ctx, 'flare'), 1, 4)
      const topH = clamp(num(ctx, 'top'), 3, 20)
      const wall = clamp(num(ctx, 'wall'), 1, 3)
      const windows = flag(ctx, 'windows')
      const spikes = flag(ctx, 'spikes')
      const house = flag(ctx, 'house')

      const widest = shaftR + 2 + flare
      const maxR = widest + 3
      const houseW = house ? Math.max(20, Math.ceil(shaftD * 3.4)) : 0
      const houseD = house ? Math.max(16, Math.ceil(shaftD * 3)) : 0
      const houseH = house ? Math.max(7, Math.min(12, Math.ceil(shaftD + 2))) : 0
      const width = Math.max(Math.ceil(maxR * 2 + 2), houseW + 4)
      const depth = Math.max(Math.ceil(maxR * 2 + 2), houseD + 4)
      const ground = house ? houseH : 0
      const baseEnd = ground + baseH
      const totalH = baseEnd + spireH + topH + 2
      const b = builderFor(ctx, width, totalH, depth)
      const cx = width / 2
      const cz = depth / 2

      // ---- the house (optional) ----------------------------------------
      if (house) {
        const hx0 = Math.floor(cx - houseW / 2)
        const hx1 = hx0 + houseW - 1
        const hz0 = Math.floor(cz - houseD / 2)
        const hz1 = hz0 + houseD - 1

        for (let y = 0; y < houseH; y++) {
          for (let z = hz0; z <= hz1; z++) {
            for (let x = hx0; x <= hx1; x++) {
              const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1
              if (edge || y === 0) b.setFull(x, y, z, R_PRIMARY)
            }
          }
        }

        // flat roof with a one-block eave
        for (let z = hz0 - 1; z <= hz1 + 1; z++) {
          for (let x = hx0 - 1; x <= hx1 + 1; x++) {
            b.setFull(x, houseH - 1, z, R_PRIMARY)
          }
        }
        // dark roof border
        for (let z = hz0 - 1; z <= hz1 + 1; z++) {
          for (let x = hx0 - 1; x <= hx1 + 1; x++) {
            if (x === hx0 - 1 || x === hx1 + 1 || z === hz0 - 1 || z === hz1 + 1) {
              b.setFull(x, houseH - 1, z, R_ACCENT)
            }
          }
        }

        // door at the front
        const doorX = Math.floor(cx) - 1
        for (let y = 0; y < 3; y++) {
          for (let x = doorX; x <= doorX + 1; x++) {
            for (let z = hz1 - 1; z <= hz1; z++) b.clear(x, y, z)
          }
        }
        for (let y = 0; y < 4; y++) {
          b.setFull(doorX - 1, y, hz1, R_ACCENT)
          b.setFull(doorX + 2, y, hz1, R_ACCENT)
        }
        for (let x = doorX - 1; x <= doorX + 2; x++) b.setFull(x, 3, hz1, R_ACCENT)
        b.setFull(doorX, 4, hz1, R_DETAIL)

        // dark windows on the front and sides
        for (let y = 2; y <= 3; y++) {
          for (const x of [hx0 + 2, hx0 + 3, hx1 - 3, hx1 - 2]) {
            b.setFull(x, y, hz1, R_ACCENT)
          }
          b.setFull(hx0, y, hz0 + 3, R_ACCENT)
          b.setFull(hx0, y, hz0 + 4, R_ACCENT)
          b.setFull(hx1, y, hz0 + 3, R_ACCENT)
          b.setFull(hx1, y, hz0 + 4, R_ACCENT)
        }
      }

      // ---- fluted quartz shaft -----------------------------------------
      for (let y = ground; y < baseEnd; y++) {
        const plinth = y < ground + 2
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            const rho = Math.hypot(x + 0.5 - cx, z + 0.5 - cz)
            if (plinth && rho <= shaftR + 1.4) {
              b.setFull(x, y, z, R_PRIMARY)
              continue
            }
            if (rho <= shaftR && (rho >= shaftR - 2 || y === ground || y === baseEnd - 1)) {
              b.setFull(x, y, z, R_PRIMARY)
            }
          }
        }
      }

      // recessed dark flutes down the shaft
      for (let y = ground; y < baseEnd; y++) {
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            const rho = Math.hypot(x + 0.5 - cx, z + 0.5 - cz)
            if (rho < shaftR - 1.2 || rho > shaftR + 0.7) continue
            const theta = Math.atan2(z + 0.5 - cz, x + 0.5 - cx)
            let fluted = false
            for (let k = 0; k < 4; k++) {
              let diff = theta - (Math.PI / 4 + (k * Math.PI) / 2)
              diff = Math.atan2(Math.sin(diff), Math.cos(diff))
              if (Math.abs(diff) < 0.11) fluted = true
            }
            if (fluted) b.setFull(x, y, z, R_ACCENT)
          }
        }
      }

      // shaft windows
      if (windows) {
        const bands = baseH >= 10 ? [ground + 3, baseEnd - 3] : [ground + 3]
        for (const wy of bands) {
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2
            for (let y = wy; y <= wy + 1; y++) {
              for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                  const rho = Math.hypot(x + 0.5 - cx, z + 0.5 - cz)
                  if (rho < shaftR - 1.2 || rho > shaftR + 0.5) continue
                  let diff = Math.atan2(z + 0.5 - cz, x + 0.5 - cx) - a
                  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
                  if (Math.abs(diff) < 0.12) b.setFull(x, y, z, R_DETAIL)
                }
              }
            }
          }
        }
      }

      // doorway when the tower stands on its own
      if (!house) {
        const doorX = Math.floor(cx) - 1
        for (let y = ground; y < ground + 3; y++) {
          for (let x = doorX; x <= doorX + 1; x++) {
            for (let z = Math.floor(cz + shaftR - 2); z <= Math.floor(cz + shaftR + 1); z++) {
              b.clear(x, y, z)
            }
          }
        }
      }

      // deck / crown
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const rho = Math.hypot(x + 0.5 - cx, z + 0.5 - cz)
          if (rho <= shaftR + 1.3) b.setFull(x, baseEnd - 1, z, rho > shaftR ? R_ACCENT : R_PRIMARY)
        }
      }

      // ---- stacked, flared obsidian spire ------------------------------
      const spireY0 = baseEnd
      const step = Math.max(0.75, (widest - 2.2) / tiers)
      const tierH = spireH / tiers
      const profile = (y: number): { r: number; i: number } => {
        const t = clamp((y - spireY0) / spireH, 0, 0.999999)
        const tierT = t * tiers
        const i = Math.min(tiers - 1, Math.floor(tierT))
        const local = tierT - i
        const rBase = widest - i * step
        const rTop = Math.max(1.15, rBase - step - flare * 0.8)
        return { r: rBase + (rTop - rBase) * local, i }
      }

      for (let y = spireY0; y < spireY0 + spireH; y++) {
        const p = profile(y)
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            const dx = x + 0.5 - cx
            const dz = z + 0.5 - cz
            const rho = Math.hypot(dx, dz)
            if (rho > p.r + 2.2) continue
            const theta = Math.atan2(dz, dx)
            const outer = p.r * (1 + 0.055 * Math.cos(6 * theta + p.i * 0.8))
            const inner = Math.max(0.75, outer - wall)
            if (rho <= outer && rho >= inner) b.setFull(x, y, z, R_ACCENT)
          }
        }
      }

      // jagged petal spikes around every tier rim
      if (spikes) {
        for (let i = 0; i < tiers; i++) {
          const y = Math.round(spireY0 + i * tierH)
          const rBase = widest - i * step
          for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4 + (i % 2) * (Math.PI / 8)
            const len = 1 + ((i + k) % 3 === 0 ? 1 : 0)
            for (let j = 0; j <= len; j++) {
              const x = Math.floor(cx + Math.cos(a) * (rBase - 0.4 + j))
              const z = Math.floor(cz + Math.sin(a) * (rBase - 0.4 + j))
              b.setFull(x, y, z, R_ACCENT)
            }
          }
        }
      }

      // glowing windows on alternating tiers
      if (windows) {
        for (let i = 0; i < tiers; i += 2) {
          const wy = Math.round(spireY0 + (i + 0.5) * tierH)
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2
            for (let y = wy; y <= wy + 1; y++) {
              const p = profile(y)
              for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                  const dx = x + 0.5 - cx
                  const dz = z + 0.5 - cz
                  const rho = Math.hypot(dx, dz)
                  if (rho < p.r - 1.3 || rho > p.r + 0.7) continue
                  let diff = Math.atan2(dz, dx) - a
                  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
                  if (Math.abs(diff) < 0.13) b.setFull(x, y, z, R_DETAIL)
                }
              }
            }
          }
        }
      }

      // ---- needle and finial -------------------------------------------
      const topStart = spireY0 + spireH
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const rho = Math.hypot(x + 0.5 - cx, z + 0.5 - cz)
          if (rho <= 2.3) b.setFull(x, topStart - 1, z, R_ACCENT)
        }
      }
      for (let y = topStart; y < topStart + topH; y++) {
        const t = (y - topStart) / Math.max(1, topH)
        const r = 1.35 - 0.5 * t
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) {
              b.setFull(x, y, z, y >= topStart + topH - 2 ? R_DETAIL : R_ACCENT)
            }
          }
        }
      }

      return b
    },
  )
}

function snowman(): ShapeDef {
  return shapeMeta(
    'snowman',
    'Giant snowman',
    'structures',
    'A three-ball snowman with hat, face and arms.',
    'A giant snowman scaled from one body diameter. The head, hat, carrot nose, coal eyes and twig arms are all generated and proportioned automatically.',
    [
      intParam('body', 'Body diameter', 20, 8, 64, { group: 'Dimensions' }),
      boolParam('hat', 'Top hat', true, { group: 'Details' }),
      boolParam('face', 'Coal face', true, { group: 'Details' }),
      boolParam('arms', 'Twig arms', true, { group: 'Details' }),
    ],
    roles(
      ['primary', 'Snow', 'minecraft:snow_block'],
      ['accent', 'Carrot', 'minecraft:orange_terracotta'],
      ['detail', 'Coal & twigs', 'minecraft:black_concrete'],
    ),
    (ctx) => {
      const D = clamp(num(ctx, 'body'), 8, 64)
      const wantHat = flag(ctx, 'hat')
      const wantFace = flag(ctx, 'face')
      const wantArms = flag(ctx, 'arms')
      const R = D / 2
      const rm = R * 0.72
      const rt = R * 0.55
      const yb = R
      const ym = 1.85 * R + rm
      const yt = ym + rm - 0.1 * R + rt
      const headTop = yt + rt
      const hatH = wantHat ? Math.max(2, Math.round(rt * 0.9)) : 0
      const armLen = wantArms ? R * 0.95 : 0
      const noseLen = wantFace ? Math.max(2, Math.round(rt * 0.85)) : 0
      const dimsX = Math.ceil(D + armLen * 2 + 4)
      const dimsZ = Math.ceil(D + noseLen + 4)
      const dimsY = Math.ceil(headTop + (wantHat ? hatH + 3 : 2))
      const b = builderFor(ctx, dimsX, dimsY, dimsZ)
      const cx = dimsX / 2
      const cz = dimsZ / 2 - noseLen / 2

      b.stampEllipsoid(cx, yb, cz, R, R, R, R_PRIMARY)
      b.stampEllipsoid(cx, ym, cz, rm, rm, rm, R_PRIMARY)
      b.stampEllipsoid(cx, yt, cz, rt, rt, rt, R_PRIMARY)

      const surfaceZ = (cy: number, rr: number, x: number, y: number): number | null => {
        const dx = x - cx
        const dy = y - cy
        const q = rr * rr - dx * dx - dy * dy
        if (q <= 0) return null
        return cz + Math.sqrt(q)
      }

      if (wantFace) {
        // eyes
        for (const sx of [-1, 1]) {
          const ex = cx + sx * rt * 0.38
          const ey = yt + rt * 0.3
          const ez = surfaceZ(yt, rt, ex, ey)
          if (ez !== null) {
            const zi = Math.floor(ez)
            b.setFull(Math.floor(ex), Math.floor(ey), zi, R_DETAIL)
            b.setFull(Math.floor(ex), Math.floor(ey), zi + 1, R_DETAIL)
          }
        }
        // smile
        for (let i = -2; i <= 2; i++) {
          const mx = cx + i * rt * 0.22
          const my = yt - rt * 0.18 - Math.abs(i) * 0.6
          const mz = surfaceZ(yt, rt, mx, my)
          if (mz !== null) b.setFull(Math.floor(mx), Math.floor(my), Math.floor(mz) + 1, R_DETAIL)
        }
        // carrot nose
        const nz = Math.floor(cz + rt * 0.9)
        for (let i = 0; i < noseLen; i++) {
          b.setFull(Math.floor(cx), Math.floor(yt), nz + i, R_ACCENT)
        }
        // buttons
        for (let i = 0; i < 3; i++) {
          const by = ym + rm * 0.45 - i * rm * 0.45
          const bz = surfaceZ(ym, rm, cx, by)
          if (bz !== null) {
            b.setFull(Math.floor(cx), Math.floor(by), Math.floor(bz) + 1, R_DETAIL)
            b.setFull(Math.floor(cx) + 1, Math.floor(by), Math.floor(bz) + 1, R_DETAIL)
          }
        }
      }

      if (wantHat) {
        const brimY = Math.ceil(headTop)
        const brimR = rt * 0.82
        for (let z = 0; z < dimsZ; z++) {
          for (let x = 0; x < dimsX; x++) {
            if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= brimR) {
              b.setFull(x, brimY, z, R_DETAIL)
            }
          }
        }
        const crownR = rt * 0.5
        const crownBase = brimY + 1
        for (let y = crownBase; y < crownBase + hatH; y++) {
          for (let z = 0; z < dimsZ; z++) {
            for (let x = 0; x < dimsX; x++) {
              if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= crownR) {
                b.setFull(x, y, z, R_DETAIL)
              }
            }
          }
        }
      }

      if (wantArms) {
        for (const dir of [-1, 1]) {
          const sx = cx + dir * rm * 0.88
          const sy = ym + rm * 0.12
          const ex = cx + dir * (rm * 0.88 + armLen)
          const ey = ym + rm * 0.82
          b.stampLine(sx, sy, cz, ex, ey, cz, 0.82, R_DETAIL, 0.4)
          b.stampLine(ex, ey, cz, ex + dir * 2.4, ey + 2.1, cz + 0.8, 0.68, R_DETAIL, 0.4)
          b.stampLine(ex, ey, cz, ex + dir * 1.4, ey + 1.8, cz - 1.6, 0.68, R_DETAIL, 0.4)
        }
      }

      return b
    },
  )
}

function igloo(): ShapeDef {
  return shapeMeta(
    'igloo',
    'Igloo',
    'structures',
    'A snow dome with a tunnel entrance.',
    'A hemispherical snow shell with a hollow interior and an entrance tunnel. The ice trim gives the doorway a crisp, buildable edge.',
    [
      intParam('diameter', 'Dome diameter', 32, 12, 96, { group: 'Dimensions' }),
      intParam('entrance', 'Tunnel length', 12, 4, 40, { group: 'Dimensions' }),
      intParam('wall', 'Shell thickness', 2, 1, 6, { group: 'Style' }),
      boolParam('trim', 'Ice trim', true, { group: 'Details' }),
    ],
    roles(
      ['primary', 'Snow', 'minecraft:snow_block'],
      ['accent', 'Ice trim', 'minecraft:packed_ice'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 12, 96)
      const ent = clamp(num(ctx, 'entrance'), 4, 40)
      const wall = clamp(num(ctx, 'wall'), 1, 6)
      const trim = flag(ctx, 'trim')
      const R = d / 2
      const domeH = R
      const dimsX = d + 2
      const dimsZ = Math.ceil(d + ent + 2)
      const dimsY = Math.ceil(domeH + 2)
      const b = builderFor(ctx, dimsX, dimsY, dimsZ)
      const cx = dimsX / 2
      const cz = d / 2 + 1
      const innerR = Math.max(0.5, R - wall)
      const innerH = Math.max(0.5, domeH - wall)

      for (let y = 0; y < dimsY; y++) {
        const samples = b.detail ? [0.25, 0.75] : [0.5]
        for (const sy of samples) {
          const yy = (y + sy) / domeH
          if (yy > 1) continue
          for (let z = 0; z < dimsZ; z++) {
            for (let x = 0; x < dimsX; x++) {
              const dx = (x + 0.5 - cx) / R
              const dz = (z + 0.5 - cz) / R
              const q = dx * dx + yy * yy + dz * dz
              if (q > 1) continue
              const mx = (x + 0.5 - cx) / innerR
              const my = (y + sy) / innerH
              const mz = (z + 0.5 - cz) / innerR
              if (mx * mx + my * my + mz * mz < 1) continue
              if (b.detail) b.setHalf(x, y, z, sy < 0.5 ? 0 : 1, R_PRIMARY)
              else b.setFull(x, y, z, R_PRIMARY)
            }
          }
        }
      }

      // floor
      for (let z = 0; z < dimsZ; z++) {
        for (let x = 0; x < dimsX; x++) {
          if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) < innerR) b.setFull(x, 0, z, R_PRIMARY)
        }
      }

      // entrance tunnel
      const zStart = Math.floor(cz + R - 2)
      const zEnd = Math.floor(cz + R + ent)
      for (let z = zStart; z <= zEnd; z++) {
        for (let x = 0; x < dimsX; x++) {
          const dx = Math.abs(x + 0.5 - cx)
          if (dx > 3) continue
          for (let y = 0; y <= 4; y++) {
            if (dx >= 2 || y === 4) b.setFull(x, y, z, R_PRIMARY)
          }
        }
      }

      // carve the tunnel bore
      for (let z = zStart; z < zEnd; z++) {
        for (let x = 0; x < dimsX; x++) {
          const dx = Math.abs(x + 0.5 - cx)
          if (dx < 2) {
            for (let y = 0; y < 4; y++) b.clear(x, y, z)
          }
        }
      }

      // doorway through the dome
      for (let y = 0; y < 5; y++) {
        for (let z = 0; z < dimsZ; z++) {
          for (let x = 0; x < dimsX; x++) {
            if (
              Math.abs(x + 0.5 - cx) < 2 &&
              z + 0.5 - cz > R * 0.45 &&
              z + 0.5 - cz < R + 1 &&
              y < 5
            ) {
              b.clear(x, y, z)
            }
          }
        }
      }

      // carve the entrance opening
      for (let x = 0; x < dimsX; x++) {
        if (Math.abs(x + 0.5 - cx) < 2) {
          for (let y = 0; y < 4; y++) b.clear(x, y, zEnd)
        }
      }

      // ice trim around the mouth
      if (trim) {
        for (let x = 0; x < dimsX; x++) {
          const dx = Math.abs(x + 0.5 - cx)
          if (dx >= 2 && dx <= 3) {
            for (let y = 0; y <= 4; y++) {
              if (y === 4 || dx > 2.5) b.setFull(x, y, zEnd, R_ACCENT)
            }
          }
        }
      }

      return b
    },
  )
}

interface Vec3 {
  x: number
  y: number
  z: number
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

function geodesicDome(): ShapeDef {
  return shapeMeta(
    'geodesic',
    'Geodesic dome',
    'structures',
    'A triangulated dome made of struts.',
    'A true subdivided-icosahedron dome. Choose the frequency for more (or fewer) triangles, and the strut thickness for your block budget.',
    [
      intParam('diameter', 'Diameter', 64, 16, 200, { group: 'Dimensions' }),
      intParam('frequency', 'Frequency', 4, 1, 6, { group: 'Style' }),
      intParam('strut', 'Strut thickness', 2, 1, 6, { group: 'Style' }),
      boolParam('nodes', 'Glowing nodes', true, { group: 'Details' }),
    ],
    roles(
      ['primary', 'Struts', 'minecraft:smooth_stone'],
      ['accent', 'Nodes', 'minecraft:sea_lantern'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 16, 200)
      const f = Math.round(clamp(num(ctx, 'frequency'), 1, 6))
      const strut = clamp(num(ctx, 'strut'), 1, 6)
      const nodes = flag(ctx, 'nodes')
      const R = d / 2
      const dimsY = Math.ceil(R + strut + 2)
      const b = builderFor(ctx, d, dimsY, d)
      const cx = d / 2
      const cz = d / 2

      const phi = (1 + Math.sqrt(5)) / 2
      const base: Vec3[] = [
        { x: 0, y: 1, z: phi },
        { x: 0, y: -1, z: phi },
        { x: 0, y: 1, z: -phi },
        { x: 0, y: -1, z: -phi },
        { x: 1, y: phi, z: 0 },
        { x: -1, y: phi, z: 0 },
        { x: 1, y: -phi, z: 0 },
        { x: -1, y: -phi, z: 0 },
        { x: phi, y: 0, z: 1 },
        { x: phi, y: 0, z: -1 },
        { x: -phi, y: 0, z: 1 },
        { x: -phi, y: 0, z: -1 },
      ].map(normalize)
      const faces = [
        [0, 11, 5],
        [0, 5, 1],
        [0, 1, 7],
        [0, 7, 10],
        [0, 10, 11],
        [1, 5, 9],
        [5, 11, 4],
        [11, 10, 2],
        [10, 7, 6],
        [7, 1, 8],
        [3, 9, 4],
        [3, 4, 2],
        [3, 2, 6],
        [3, 6, 8],
        [3, 8, 9],
        [4, 9, 5],
        [2, 4, 11],
        [6, 2, 10],
        [8, 6, 7],
        [9, 8, 1],
      ]

      // Rotate the icosahedron so one vertex points straight up.
      const up: Vec3 = { x: 0, y: 1, z: 0 }
      const v0 = base[0]
      const axis = normalize({
        x: v0.y * up.z - v0.z * up.y,
        y: v0.z * up.x - v0.x * up.z,
        z: v0.x * up.y - v0.y * up.x,
      })
      const angle = Math.acos(Math.max(-1, Math.min(1, v0.y)))
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const rotate = (v: Vec3): Vec3 => {
        const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z
        const cross = {
          x: axis.y * v.z - axis.z * v.y,
          y: axis.z * v.x - axis.x * v.z,
          z: axis.x * v.y - axis.y * v.x,
        }
        return {
          x: v.x * cosA + cross.x * sinA + axis.x * dot * (1 - cosA),
          y: v.y * cosA + cross.y * sinA + axis.y * dot * (1 - cosA),
          z: v.z * cosA + cross.z * sinA + axis.z * dot * (1 - cosA),
        }
      }
      const verts = base.map(rotate)
      const point = (a: Vec3, bb: Vec3, c: Vec3, i: number, j: number, k: number): Vec3 =>
        normalize({
          x: (a.x * i + bb.x * j + c.x * k) / f,
          y: (a.y * i + bb.y * j + c.y * k) / f,
          z: (a.z * i + bb.z * j + c.z * k) / f,
        })

      const keyOf = (v: Vec3): string => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`
      const edge = new Set<string>()
      const boundary: Vec3[] = []

      for (const [ai, bi, ci] of faces) {
        const a = verts[ai]
        const bb = verts[bi]
        const c = verts[ci]
        const local = new Map<string, Vec3>()
        for (let i = 0; i <= f; i++) {
          for (let j = 0; j <= f - i; j++) {
            const k = f - i - j
            const p = point(a, bb, c, i, j, k)
            local.set(`${i},${j},${k}`, p)
            if (p.y >= -0.08 && p.y <= 0.06) boundary.push(p)
          }
        }
        const addEdge = (p1: Vec3, p2: Vec3): void => {
          if (p1.y < -0.05 || p2.y < -0.05) return
          const k1 = keyOf(p1)
          const k2 = keyOf(p2)
          const key = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
          edge.add(key)
        }
        for (let i = 0; i <= f; i++) {
          for (let j = 0; j <= f - i; j++) {
            const k = f - i - j
            const p = local.get(`${i},${j},${k}`)!
            if (j > 0) {
              const q = local.get(`${i + 1},${j - 1},${k}`)
              if (q) addEdge(p, q)
            }
            if (k > 0) {
              const q1 = local.get(`${i},${j + 1},${k - 1}`)
              if (q1) addEdge(p, q1)
              const q2 = local.get(`${i + 1},${j},${k - 1}`)
              if (q2) addEdge(p, q2)
            }
          }
        }
      }

      const toWorld = (v: Vec3): Vec3 => ({
        x: cx + v.x * R,
        y: 0.5 + v.y * R,
        z: cz + v.z * R,
      })
      const seenVertices = new Set<string>()

      for (const key of edge) {
        const [aKey, bKey] = key.split('|')
        const a = aKey.split(',').map(Number)
        const bb = bKey.split(',').map(Number)
        const p1 = toWorld({ x: a[0], y: a[1], z: a[2] })
        const p2 = toWorld({ x: bb[0], y: bb[1], z: bb[2] })
        b.stampLine(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, strut / 2, R_PRIMARY, 0.5)
        if (nodes) {
          for (const p of [p1, p2]) {
            const vk = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`
            if (!seenVertices.has(vk)) {
              seenVertices.add(vk)
              b.stampBall(p.x, p.y, p.z, strut / 2 + 0.35, R_ACCENT)
            }
          }
        }
      }

      // base ring
      const steps = Math.max(64, Math.ceil((Math.PI * 2 * R) / 0.7))
      for (let i = 0; i < steps; i++) {
        const a0 = (i / steps) * Math.PI * 2
        const a1 = ((i + 1) / steps) * Math.PI * 2
        b.stampLine(
          cx + R * 0.995 * Math.cos(a0),
          1,
          cz + R * 0.995 * Math.sin(a0),
          cx + R * 0.995 * Math.cos(a1),
          1,
          cz + R * 0.995 * Math.sin(a1),
          strut / 2 + 0.2,
          R_PRIMARY,
          0.6,
        )
      }

      return b
    },
  )
}

export const STRUCTURE_SHAPES: ShapeDef[] = [
  observatory(),
  wizardTower(),
  lighthouse(),
  dopeTower(),
  snowman(),
  igloo(),
  geodesicDome(),
]
