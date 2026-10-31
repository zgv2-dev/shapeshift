import type { ShapeDef } from '../types'
import { builderFor } from '../voxel'
import {
  ROLES_STONE,
  R_PRIMARY,
  boolParam,
  clamp,
  flag,
  intParam,
  num,
  shapeMeta,
  floatParam,
} from './util'

function prism(): ShapeDef {
  return shapeMeta(
    'prism',
    'Prism',
    'solids',
    'Any regular polygon, extruded to any height.',
    'Pick 3 to 24 sides for everything from triangular wedges to near-round towers. The rotation control lines the flats up with your build grid.',
    [
      intParam('sides', 'Sides', 6, 3, 24, { group: 'Dimensions' }),
      intParam('diameter', 'Diameter', 48, 8, 256),
      intParam('height', 'Height', 32, 1, 256),
      intParam('rotate', 'Rotation', 0, 0, 90, { step: 15, unit: '°', group: 'Style' }),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 2, 1, 32, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const sides = Math.round(clamp(num(ctx, 'sides'), 3, 24))
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const rot = (num(ctx, 'rotate') * Math.PI) / 180
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const R = d / 2
      const sector = (Math.PI * 2) / sides
      const outer = (rho: number, theta: number): boolean => {
        const a = (((theta - rot) % sector) + sector) % sector
        return rho * Math.cos(a - sector / 2) <= R * Math.cos(Math.PI / sides)
      }
      const inner = (rho: number, theta: number): boolean => {
        const ri = R - wall
        if (ri <= 0) return false
        const a = (((theta - rot) % sector) + sector) % sector
        return rho * Math.cos(a - sector / 2) <= ri * Math.cos(Math.PI / sides)
      }
      b.rasterize((x, _y, z) => {
        const dx = x - c
        const dz = z - c
        const rho = Math.hypot(dx, dz)
        const theta = Math.atan2(dz, dx)
        if (!outer(rho, theta)) return 0
        if (hollow && inner(rho, theta)) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function box(): ShapeDef {
  return shapeMeta(
    'box',
    'Box',
    'solids',
    'A rectangular room, tank or plinth.',
    'A crisp cuboid with independent width, height and depth. Hollow it with any wall thickness to block out rooms, containers and bases.',
    [
      intParam('width', 'Width (X)', 48, 2, 256),
      intParam('height', 'Height (Y)', 32, 2, 256),
      intParam('depth', 'Depth (Z)', 48, 2, 256),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 2, 1, 32, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 2, 256)
      const h = clamp(num(ctx, 'height'), 2, 256)
      const d = clamp(num(ctx, 'depth'), 2, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, d)
      const w2 = w - wall
      const h2 = h - wall
      const d2 = d - wall
      b.rasterize((x, y, z) => {
        if (x < 0 || y < 0 || z < 0 || x > w || y > h || z > d) return 0
        if (hollow && wall * 2 < Math.min(w, h, d)) {
          if (x > wall && x < w2 && y > wall && y < h2 && z > wall && z < d2) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function diamond(): ShapeDef {
  return shapeMeta(
    'diamond',
    'Diamond',
    'solids',
    'Two pyramids joined at the base.',
    'A classic gem or octahedral monument. Width controls the square equator, height controls the total tip-to-tip distance.',
    [
      intParam('width', 'Width', 48, 8, 256, { group: 'Dimensions' }),
      intParam('height', 'Height', 64, 8, 256),
      boolParam('hollow', 'Hollow shell', false),
      intParam('wall', 'Wall thickness', 2, 1, 32, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, w, h, w)
      const c = w / 2
      const cy = h / 2
      b.rasterize((x, y, z) => {
        const half = (w / 2) * (1 - Math.abs(y - cy) / cy)
        if (half <= 0) return 0
        const m = Math.max(Math.abs(x - c), Math.abs(z - c))
        if (m > half) return 0
        if (hollow && wall < w / 2 && m < Math.max(0, half - wall)) {
          const innerHalf = (w / 2 - wall) * (1 - Math.abs(y - cy) / (cy - wall))
          if (innerHalf > 0 && m < innerHalf) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function star(): ShapeDef {
  return shapeMeta(
    'star',
    'Star',
    'solids',
    'A five-pointed (or n-pointed) star prism.',
    'A star-shaped extrusion with adjustable points and inner radius. Use it for emblems, compass roses, gears-with-style and giant tree toppers.',
    [
      intParam('points', 'Points', 5, 3, 24, { group: 'Dimensions' }),
      intParam('diameter', 'Diameter', 64, 8, 256),
      floatParam('inner', 'Inner radius', 0.45, 0.15, 0.9, { step: 0.05, group: 'Style' }),
      intParam('height', 'Height', 4, 1, 256),
      boolParam('hollow', 'Outline only', false),
      intParam('wall', 'Outline width', 3, 1, 32, { showIf: { key: 'hollow', equals: true } }),
    ],
    ROLES_STONE,
    (ctx) => {
      const points = Math.round(clamp(num(ctx, 'points'), 3, 24))
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const innerRatio = clamp(num(ctx, 'inner'), 0.15, 0.9)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const hollow = flag(ctx, 'hollow')
      const wall = num(ctx, 'wall')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const ro = d / 2
      const ri = ro * innerRatio
      const step = Math.PI / points
      const starRadius = (theta: number, outer: number, innerR: number): number => {
        let a = (((theta + Math.PI / 2) % (2 * step)) + 2 * step) % (2 * step)
        if (a <= step) return outer + (innerR - outer) * (a / step)
        a -= step
        return innerR + (outer - innerR) * (a / step)
      }
      b.rasterize((x, _y, z) => {
        const dx = x - c
        const dz = z - c
        const rho = Math.hypot(dx, dz)
        const theta = Math.atan2(dz, dx)
        const rr = starRadius(theta, ro, ri)
        if (rho > rr) return 0
        if (hollow && wall < ro) {
          const rIn = starRadius(theta, ro - wall, Math.max(0.5, ri - wall))
          if (rho < rIn) return 0
        }
        return R_PRIMARY
      })
      return b
    },
  )
}

function cross(): ShapeDef {
  return shapeMeta(
    'cross',
    'Cross',
    'solids',
    'A plus-sign prism for church plans and motifs.',
    'A cross-shaped extrusion with adjustable arm length, arm width and height. Perfect for cathedral footprints, emblems and runway markings.',
    [
      intParam('diameter', 'Arm span', 64, 8, 256, { group: 'Dimensions' }),
      intParam('arm', 'Arm width', 20, 2, 256),
      intParam('height', 'Height', 4, 1, 256),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const arm = Math.min(clamp(num(ctx, 'arm'), 2, 256), d)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const a = arm / 2
      const r = d / 2
      b.rasterize((x, _y, z) => {
        const dx = Math.abs(x - c)
        const dz = Math.abs(z - c)
        return (dx <= a && dz <= r) || (dz <= a && dx <= r) ? R_PRIMARY : 0
      })
      return b
    },
  )
}

function crescent(): ShapeDef {
  return shapeMeta(
    'crescent',
    'Crescent',
    'solids',
    'A moon crescent cut from a disc.',
    'A circle with a second circle bitten out of it. The thickness control moves the bite, changing the horns from slim to bold.',
    [
      intParam('diameter', 'Diameter', 64, 8, 256, { group: 'Dimensions' }),
      intParam('bite', 'Bite offset', 28, 2, 254, { hint: 'How far the cut-out circle moves; larger values make a thicker crescent.' }),
      intParam('height', 'Height', 4, 1, 256),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const bite = Math.min(clamp(num(ctx, 'bite'), 2, 254), d * 1.8)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const R = d / 2
      b.rasterize((x, _y, z) => {
        const dx = x - c
        const dz = z - c
        if (Math.hypot(dx, dz) > R) return 0
        const cut = Math.hypot(dx - bite, dz)
        if (cut < R) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

function gear(): ShapeDef {
  return shapeMeta(
    'gear',
    'Gear',
    'solids',
    'A cog with teeth and an axle hole.',
    'A proper gear prism: choose the tooth count, tooth depth and axle bore. Bring it to life with a rotating light or a hidden redstone circuit.',
    [
      intParam('diameter', 'Diameter', 48, 8, 256, { group: 'Dimensions' }),
      intParam('teeth', 'Teeth', 12, 4, 32, { group: 'Dimensions' }),
      intParam('tooth', 'Tooth depth', 4, 1, 32, { group: 'Style' }),
      intParam('hole', 'Axle hole', 10, 0, 200, { group: 'Style' }),
      intParam('height', 'Height', 4, 1, 256),
      intParam('rotate', 'Rotation', 0, 0, 90, { step: 15, unit: '°', group: 'Style' }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const teeth = Math.round(clamp(num(ctx, 'teeth'), 4, 32))
      const tooth = clamp(num(ctx, 'tooth'), 1, 32)
      const hole = Math.min(clamp(num(ctx, 'hole'), 0, 200), d - 2)
      const h = clamp(num(ctx, 'height'), 1, 256)
      const rot = (num(ctx, 'rotate') * Math.PI) / 180
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const R = d / 2
      const sector = (Math.PI * 2) / teeth
      b.rasterize((x, _y, z) => {
        const dx = x - c
        const dz = z - c
        const rho = Math.hypot(dx, dz)
        if (rho < hole / 2) return 0
        const theta = Math.atan2(dz, dx) + rot
        const a = ((theta % sector) + sector) % sector
        const outer = a < sector * 0.5 ? R : R - tooth
        return rho <= outer ? R_PRIMARY : 0
      })
      return b
    },
  )
}

function arch(): ShapeDef {
  return shapeMeta(
    'arch',
    'Arch',
    'solids',
    'Standing arches for gates, bridges and portals.',
    'A freestanding arch with legs and a curved crown. The depth is the thickness of the wall you are building, so it drops straight into a bridge or gatehouse.',
    [
      intParam('width', 'Span', 48, 8, 256, { group: 'Dimensions' }),
      intParam('height', 'Height', 40, 8, 256),
      intParam('depth', 'Depth', 8, 1, 64),
      intParam('wall', 'Wall thickness', 4, 1, 32),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const d = clamp(num(ctx, 'depth'), 1, 64)
      const wall = clamp(num(ctx, 'wall'), 1, Math.floor(w / 2) - 1)
      const b = builderFor(ctx, w, h, d)
      const cx = w / 2
      const cz = d / 2
      const rx = w / 2
      const sy = Math.max(2, Math.min(h - 4, h * 0.45))
      const rise = h - sy
      const insideOuter = (x: number, y: number): boolean => {
        const dx = x - cx
        if (y <= sy) return Math.abs(dx) <= rx
        const dy = (y - sy) / rise
        return (dx / rx) ** 2 + dy * dy <= 1
      }
      const insideInner = (x: number, y: number): boolean => {
        const dx = x - cx
        const irx = rx - wall
        const irise = rise - wall
        if (y <= sy) return Math.abs(dx) <= irx
        if (irise <= 0) return false
        const dy = (y - sy) / irise
        return (dx / irx) ** 2 + dy * dy <= 1
      }
      b.rasterize((x, y, z) => {
        if (Math.abs(z - cz) > d / 2) return 0
        if (!insideOuter(x, y)) return 0
        if (insideInner(x, y)) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

export const SOLID_SHAPES: ShapeDef[] = [
  prism(),
  box(),
  diamond(),
  star(),
  cross(),
  crescent(),
  gear(),
  arch(),
]
