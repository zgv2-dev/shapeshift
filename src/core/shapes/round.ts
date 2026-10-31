import { builderFor } from '../voxel'
import type { ShapeDef } from '../types'
import {
  ROLES_STONE,
  R_PRIMARY,
  boolParam,
  clamp,
  flag,
  floatParam,
  intParam,
  num,
  selectParam,
  shapeMeta,
  str,
} from './util'

function sphere(): ShapeDef {
  return shapeMeta(
    'sphere',
    'Sphere',
    'round',
    'The classic. Round, hollow and slab-smoothed.',
    'A perfectly balanced sphere. Leave it hollow for a shell, or fill it in for a solid orb. With half-slab detail on, the silhouette gains twice the vertical resolution.',
    [
      intParam('diameter', 'Diameter', 48, 8, 256, { group: 'Dimensions' }),
      boolParam('hollow', 'Hollow shell', true),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, d, d)
      const c = d / 2
      const ro = d / 2
      const ri = hollow ? Math.max(0, ro - wall) : 0
      const ri2 = ri * ri
      b.rasterize((x, y, z) => {
        const dx = x - c
        const dy = y - c
        const dz = z - c
        const q = dx * dx + dy * dy + dz * dz
        if (q > ro * ro) return 0
        if (!hollow || wall >= ro) return R_PRIMARY
        return q > ri2 ? R_PRIMARY : 0
      })
      return b
    },
  )
}

function ellipsoid(): ShapeDef {
  return shapeMeta(
    'ellipsoid',
    'Ellipsoid',
    'round',
    'Stretch a sphere into planets, hulls and pods.',
    'Independent width, height and depth make this the workhorse for airship envelopes, planets and organic pods. The shell can be as thick as you like.',
    [
      intParam('width', 'Width (X)', 64, 8, 256),
      intParam('height', 'Height (Y)', 40, 8, 256),
      intParam('depth', 'Depth (Z)', 64, 8, 256),
      boolParam('hollow', 'Hollow shell', true),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const d = clamp(num(ctx, 'depth'), 8, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, d)
      const cx = w / 2
      const cy = h / 2
      const cz = d / 2
      const rx = w / 2
      const ry = h / 2
      const rz = d / 2
      const ix = Math.max(0.001, rx - wall)
      const iy = Math.max(0.001, ry - wall)
      const iz = Math.max(0.001, rz - wall)
      b.rasterize((x, y, z) => {
        const nx = (x - cx) / rx
        const ny = (y - cy) / ry
        const nz = (z - cz) / rz
        if (nx * nx + ny * ny + nz * nz > 1) return 0
        if (hollow) {
          const mx = (x - cx) / ix
          const my = (y - cy) / iy
          const mz = (z - cz) / iz
          if (mx * mx + my * my + mz * mz < 1 && wall < Math.min(rx, ry, rz)) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function dome(): ShapeDef {
  return shapeMeta(
    'dome',
    'Dome',
    'round',
    'A half-ellipsoid shell for observatories and halls.',
    'An open-bottomed dome with an adjustable rise. Thickness follows the curve, so the rim and crown stay solid at any scale.',
    [
      intParam('diameter', 'Diameter', 48, 8, 256),
      intParam('height', 'Rise', 26, 4, 128),
      boolParam('hollow', 'Hollow shell', true),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 4, 128)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const rx = d / 2
      const ry = h
      const ix = Math.max(0.001, rx - wall)
      const iy = Math.max(0.001, ry - wall)
      b.rasterize((x, y, z) => {
        const dx = (x - c) / rx
        const dy = y / ry
        const dz = (z - c) / rx
        if (y < 0) return 0
        if (dx * dx + dy * dy + dz * dz > 1) return 0
        if (hollow && wall < Math.min(rx, ry)) {
          const mx = (x - c) / ix
          const my = y / iy
          const mz = (z - c) / ix
          if (mx * mx + my * my + mz * mz < 1) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function torus(): ShapeDef {
  return shapeMeta(
    'torus',
    'Torus',
    'round',
    'Doughnuts, oval rings and portal frames.',
    'A ring with a round tube. Lay it flat or stand it upright on X or Z, stretch it into an oval, and optionally hollow the tube itself.',
    [
      intParam('diameter', 'Overall diameter', 64, 8, 256),
      intParam('tube', 'Tube diameter', 16, 2, 128),
      selectParam(
        'axis',
        'Axis',
        'y',
        [
          { value: 'y', label: 'Flat · Y' },
          { value: 'x', label: 'Upright · X' },
          { value: 'z', label: 'Upright · Z' },
        ],
        { group: 'Style', hint: 'Y lies flat like a doughnut; X and Z stand it upright.' },
      ),
      floatParam('stretch', 'Elliptical stretch', 1, 1, 2.5, {
        step: 0.05,
        group: 'Style',
        hint: '1 = round. 2 = twice as wide on one plane axis. Capped at large diameters by the 256-block limit.',
      }),
      boolParam('hollow', 'Hollow tube', false),
      intParam('wall', 'Tube wall', 2, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      let tube = clamp(num(ctx, 'tube'), 2, 128)
      tube = Math.min(tube, d - 2)
      const axis = str(ctx, 'axis')
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const stretch = Math.min(clamp(num(ctx, 'stretch'), 1, 2.5), 256 / d)
      const b =
        axis === 'x'
          ? builderFor(ctx, tube, Math.ceil(d * stretch), d)
          : axis === 'z'
            ? builderFor(ctx, Math.ceil(d * stretch), d, tube)
            : builderFor(ctx, Math.ceil(d * stretch), tube, d)
      const major = (d - tube) / 2
      const r = tube / 2
      const ri = Math.max(0, r - wall)
      b.rasterize((x, y, z) => {
        let dr: number
        let cross: number
        if (axis === 'x') {
          const cy = b.ny / 2
          const cz = d / 2
          dr = Math.hypot((y - cy) / stretch, z - cz) - major
          cross = x - tube / 2
        } else if (axis === 'z') {
          const cx = b.nx / 2
          const cy = d / 2
          dr = Math.hypot((x - cx) / stretch, y - cy) - major
          cross = z - tube / 2
        } else {
          const cx = b.nx / 2
          const cz = d / 2
          dr = Math.hypot((x - cx) / stretch, z - cz) - major
          cross = y - tube / 2
        }
        const q = dr * dr + cross * cross
        if (q > r * r) return 0
        if (hollow && ri > 0 && q < ri * ri) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function ellipse(): ShapeDef {
  return shapeMeta(
    'ellipse',
    'Ellipse disc',
    'round',
    'Flat circles for floors, plazas and rings.',
    'A flat elliptical slab one or more blocks thick. Hollow it for a ring of any width — perfect for curved plazas, medallions and arena floors.',
    [
      intParam('width', 'Width (X)', 64, 8, 256),
      intParam('depth', 'Depth (Z)', 40, 8, 256),
      intParam('height', 'Thickness', 1, 1, 16),
      boolParam('hollow', 'Hollow ring', false),
      intParam('wall', 'Ring width', 2, 1, 32, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 1, 16)
      const d = clamp(num(ctx, 'depth'), 8, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, d)
      const cx = w / 2
      const cz = d / 2
      const rx = w / 2
      const rz = d / 2
      const ix = Math.max(0.001, rx - wall)
      const iz = Math.max(0.001, rz - wall)
      b.rasterize((x, _y, z) => {
        const nx = (x - cx) / rx
        const nz = (z - cz) / rz
        if (nx * nx + nz * nz > 1) return 0
        if (hollow && wall < Math.min(rx, rz)) {
          const mx = (x - cx) / ix
          const mz = (z - cz) / iz
          if (mx * mx + mz * mz < 1) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function cylinder(): ShapeDef {
  return shapeMeta(
    'cylinder',
    'Cylinder',
    'round',
    'Towers, columns and open tubes.',
    'A clean cylinder with optional cap discs. Hollow it for a tube, stack several for a fluted tower.',
    [
      intParam('diameter', 'Diameter', 48, 8, 256),
      intParam('height', 'Height', 40, 1, 256),
      boolParam('hollow', 'Hollow tube', true),
      intParam('wall', 'Wall thickness', 1, 1, 24, { showIf: { key: 'hollow', equals: true } }),
      boolParam('caps', 'Cap top & bottom', false, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const caps = flag(ctx, 'caps')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const r = d / 2
      const ri = Math.max(0, r - wall)
      b.rasterize((x, y, z) => {
        const rho = Math.hypot(x - c, z - c)
        if (rho > r) return 0
        if (!hollow) return R_PRIMARY
        const cap = caps && (y < wall || y > h - wall)
        if (cap) return R_PRIMARY
        if (ri > 0 && rho < ri) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function cone(): ShapeDef {
  return shapeMeta(
    'cone',
    'Cone',
    'round',
    'Tapered roofs, spikes and party hats.',
    'A circular cone with a smooth, slab-friendly tip. Hollow it to create a shell with a consistent wall.',
    [
      intParam('diameter', 'Base diameter', 48, 8, 256),
      intParam('height', 'Height', 40, 1, 256),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const r0 = d / 2
      b.rasterize((x, y, z) => {
        const r = r0 * (1 - y / h)
        if (r <= 0) return 0
        const rho = Math.hypot(x - c, z - c)
        if (rho > r + 0.35) return 0
        if (hollow && r > wall) {
          const inner = r - wall
          if (rho < inner) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function frustum(): ShapeDef {
  return shapeMeta(
    'frustum',
    'Frustum',
    'round',
    'Tapered towers, lamp shades and flower pots.',
    'A cylinder that tapers from a wide base to a narrower top — or the other way round. Set the top to zero for a cone.',
    [
      intParam('bottom', 'Bottom diameter', 48, 2, 256),
      intParam('top', 'Top diameter', 16, 0, 256),
      intParam('height', 'Height', 32, 1, 256),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const bot = clamp(num(ctx, 'bottom'), 2, 256)
      const top = clamp(num(ctx, 'top'), 0, 256)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const d = Math.max(bot, top, 2)
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const r0 = bot / 2
      const r1 = top / 2
      b.rasterize((x, y, z) => {
        const r = r0 + (r1 - r0) * (y / h)
        if (r <= 0) return 0
        const rho = Math.hypot(x - c, z - c)
        if (rho > r + 0.35) return 0
        if (hollow && r > wall) {
          if (rho < r - wall) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function pyramid(): ShapeDef {
  return shapeMeta(
    'pyramid',
    'Pyramid',
    'round',
    'Stepped square pyramids for tombs and roofs.',
    'A square pyramid built from clean stepped courses. Hollow it to leave a floor and four sloped walls.',
    [
      intParam('base', 'Base width', 48, 8, 256),
      intParam('height', 'Height', 32, 1, 256),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 2, 1, 32, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const base = clamp(num(ctx, 'base'), 8, 256)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, base, h, base)
      const c = base / 2
      b.rasterize((x, y, z) => {
        const half = (base / 2) * (1 - y / h)
        if (half <= 0) return 0
        const m = Math.max(Math.abs(x - c), Math.abs(z - c))
        if (m > half) return 0
        if (hollow && wall < base / 2 && y > wall && m < Math.max(0, half - wall)) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function capsule(): ShapeDef {
  return shapeMeta(
    'capsule',
    'Capsule',
    'round',
    'Rockets, tanks and smooth-ended towers.',
    'A cylinder with hemispherical caps. Total height includes both caps; hollow it for a fuel tank shell.',
    [
      intParam('diameter', 'Diameter', 32, 8, 256),
      intParam('height', 'Total height', 64, 8, 256),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = Math.max(d, clamp(num(ctx, 'height'), 8, 256))
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const r = d / 2
      const ri = Math.max(0, r - wall)
      const capOuter = (x: number, y: number, z: number): boolean => {
        const dy = y < r ? y - r : y > h - r ? y - (h - r) : 0
        return Math.hypot(x - c, dy, z - c) <= r
      }
      b.rasterize((x, y, z) => {
        if (!capOuter(x, y, z)) return 0
        if (hollow && ri > 0) {
          const dy = y < r ? y - r : y > h - r ? y - (h - r) : 0
          if (Math.hypot(x - c, dy, z - c) < ri) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function paraboloid(): ShapeDef {
  return shapeMeta(
    'paraboloid',
    'Paraboloid',
    'round',
    'Dishes, amphitheatres and upturned bowls.',
    'An upward-opening parabolic dish. The wall option thickens the skin; turn hollow off for a solid bowl of blocks.',
    [
      intParam('diameter', 'Rim diameter', 64, 8, 256),
      intParam('height', 'Depth', 24, 1, 128),
      boolParam('hollow', 'Hollow shell', true),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 1, 128)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const R = d / 2
      b.rasterize((x, y, z) => {
        const t = clamp(y / h, 0, 1)
        const surf = R * Math.sqrt(t)
        const rho = Math.hypot(x - c, z - c)
        if (rho > surf + 0.35) return 0
        if (hollow && surf > wall && rho < surf - wall) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function hyperboloid(): ShapeDef {
  return shapeMeta(
    'hyperboloid',
    'Hyperboloid',
    'round',
    'Cooling towers, hourglasses and warp funnels.',
    'A one-sheet hyperboloid whose waist can be pinched as tightly as you like. Perfect for cooling towers and sci-fi cores.',
    [
      intParam('diameter', 'End diameter', 64, 8, 256),
      intParam('height', 'Height', 48, 2, 256),
      floatParam('waist', 'Waist ratio', 0.4, 0.05, 0.95, { step: 0.05 }),
      boolParam('hollow', 'Hollow shell', true),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 2, 256)
      const waist = clamp(num(ctx, 'waist'), 0.05, 0.95)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const R = d / 2
      b.rasterize((x, y, z) => {
        const t = (2 * y) / h - 1
        const surf = R * Math.sqrt(waist * waist + (1 - waist * waist) * t * t)
        const rho = Math.hypot(x - c, z - c)
        if (rho > surf + 0.35) return 0
        if (hollow && surf > wall && rho < surf - wall) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function egg(): ShapeDef {
  return shapeMeta(
    'egg',
    'Egg',
    'round',
    'A smooth, pointy-topped egg.',
    'An eggshell with a controllable point. Hollow it for a shell or fill it for a solid sculpture.',
    [
      intParam('height', 'Height', 48, 8, 256),
      intParam('width', 'Width', 32, 8, 256),
      floatParam('pointy', 'Pointiness', 0.3, 0, 0.45, { step: 0.05, group: 'Style' }),
      boolParam('hollow', 'Hollow shell', true),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const pointy = clamp(num(ctx, 'pointy'), 0, 0.45)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, w)
      const c = w / 2
      const R = w / 2
      const hr = h / 2
      b.rasterize((x, y, z) => {
        const t = (y - hr) / hr
        if (Math.abs(t) >= 1) return 0
        const r = R * Math.sqrt(1 - t * t) * (1 - pointy * t)
        if (r <= 0) return 0
        const rho = Math.hypot(x - c, z - c)
        if (rho > r + 0.35) return 0
        if (hollow && wall < R) {
          const ti = (y - hr) / (hr - wall)
          if (Math.abs(ti) < 1) {
            const ri = (R - wall) * Math.sqrt(1 - ti * ti) * (1 - pointy * ti)
            if (rho < ri) return 0
          }
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function heart(): ShapeDef {
  return shapeMeta(
    'heart',
    'Heart',
    'round',
    'A proper 3D heart, not a flat cut-out.',
    'A volumetric heart generated from an implicit surface. Sized independently in width, height and depth, with a shell option for larger builds.',
    [
      intParam('width', 'Width', 48, 8, 160),
      intParam('height', 'Height', 44, 8, 160),
      intParam('depth', 'Depth', 28, 6, 160),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 160)
      const h = clamp(num(ctx, 'height'), 8, 160)
      const d = clamp(num(ctx, 'depth'), 6, 160)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, d)
      const x0 = -1.1333
      const x1 = 1.1333
      const y0 = -0.6667
      const y1 = 0.6667
      const z0 = -1
      const z1 = 1.2
      const inside = (xn: number, yn: number, zn: number): boolean => {
        const a = xn * xn + 2.25 * yn * yn + zn * zn - 1
        return a * a * a - xn * xn * zn * zn * zn - 0.1125 * yn * yn * zn * zn * zn <= 0
      }
      b.rasterize((x, y, z) => {
        const xn = x0 + (x / w) * (x1 - x0)
        const yn = y0 + (z / d) * (y1 - y0)
        const zn = z0 + (y / h) * (z1 - z0)
        if (!inside(xn, yn, zn)) return 0
        if (hollow && wall < Math.min(w, h, d) / 2) {
          if (x > wall && x < w - wall && y > wall && y < h - wall && z > wall && z < d - wall) {
            const ix = x0 + ((x - wall) / (w - 2 * wall)) * (x1 - x0)
            const iy = y0 + ((z - wall) / (d - 2 * wall)) * (y1 - y0)
            const iz = z0 + ((y - wall) / (h - 2 * wall)) * (z1 - z0)
            if (inside(ix, iy, iz)) return 0
          }
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function superellipsoid(): ShapeDef {
  return shapeMeta(
    'superellipsoid',
    'Rounded box',
    'round',
    'Soft-edged cubes, pods and control rooms.',
    'A superellipsoid: exponent 2 is a sphere, higher values square off the corners into a soft cube. Slab detail keeps the corners crisp without the bulk.',
    [
      intParam('width', 'Width', 48, 8, 256),
      intParam('height', 'Height', 40, 8, 256),
      intParam('depth', 'Depth', 48, 8, 256),
      floatParam('roundness', 'Roundness', 4, 2, 12, { step: 0.5, group: 'Style' }),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 1, 1, 16, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const d = clamp(num(ctx, 'depth'), 8, 256)
      const n = clamp(num(ctx, 'roundness'), 2, 12)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, d)
      const cx = w / 2
      const cy = h / 2
      const cz = d / 2
      const rx = w / 2
      const ry = h / 2
      const rz = d / 2
      b.rasterize((x, y, z) => {
        const q =
          Math.pow(Math.abs((x - cx) / rx), n) +
          Math.pow(Math.abs((y - cy) / ry), n) +
          Math.pow(Math.abs((z - cz) / rz), n)
        if (q > 1) return 0
        if (hollow && wall < Math.min(rx, ry, rz)) {
          const qi =
            Math.pow(Math.abs((x - cx) / (rx - wall)), n) +
            Math.pow(Math.abs((y - cy) / (ry - wall)), n) +
            Math.pow(Math.abs((z - cz) / (rz - wall)), n)
          if (qi < 1) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function ring(): ShapeDef {
  return shapeMeta(
    'ring',
    'Ring',
    'round',
    'A flat washer for rims, fountains and portals.',
    'A flat annulus with independent outer and inner diameters. Unlike the torus, the cross-section is square, giving crisp coping and rim detail.',
    [
      intParam('diameter', 'Outer diameter', 64, 8, 256),
      intParam('inner', 'Inner diameter', 32, 2, 254),
      intParam('height', 'Height', 1, 1, 64),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const inner = Math.min(clamp(num(ctx, 'inner'), 2, 254), d - 2)
      const h = clamp(num(ctx, 'height'), 1, 64)
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const ro = d / 2
      const ri = inner / 2
      b.rasterize((x, _y, z) => {
        const rho = Math.hypot(x - c, z - c)
        return rho <= ro && rho >= ri ? R_PRIMARY : 0
      })
      return b
    },
  )
}

export const ROUND_SHAPES: ShapeDef[] = [
  sphere(),
  ellipsoid(),
  dome(),
  torus(),
  ellipse(),
  cylinder(),
  cone(),
  frustum(),
  pyramid(),
  capsule(),
  paraboloid(),
  hyperboloid(),
  egg(),
  heart(),
  superellipsoid(),
  ring(),
]

