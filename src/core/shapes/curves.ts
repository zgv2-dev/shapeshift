import type { ShapeDef } from '../types'
import { builderFor } from '../voxel'
import {
  ROLES_STONE,
  R_ACCENT,
  R_PRIMARY,
  boolParam,
  clamp,
  flag,
  floatParam,
  intParam,
  num,
  roles,
  selectParam,
  shapeMeta,
  str,
} from './util'

function helix(): ShapeDef {
  return shapeMeta(
    'helix',
    'Helix',
    'curves',
    'A rising spiral tube — DNA, coils and drill bits.',
    'A smooth tube swept along a helical path. Tune the orbit, rise, tube diameter and turn count to make anything from a spring to a spiral flume.',
    [
      intParam('diameter', 'Orbit diameter', 48, 8, 256, { group: 'Dimensions' }),
      intParam('height', 'Height', 64, 8, 256),
      intParam('tube', 'Tube diameter', 8, 2, 64),
      floatParam('turns', 'Turns', 3, 0.5, 8, { step: 0.25, group: 'Style' }),
      boolParam('clockwise', 'Clockwise', true, { group: 'Style' }),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const tube = Math.min(clamp(num(ctx, 'tube'), 2, 64), d - 2)
      const turns = clamp(num(ctx, 'turns'), 0.5, 8)
      const cw = flag(ctx, 'clockwise')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const orbit = Math.max(1, (d - tube) / 2)
      const r = tube / 2
      const steps = Math.max(320, Math.ceil((turns * Math.PI * 2 * orbit) / 0.45))
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const a = (cw ? 1 : -1) * turns * Math.PI * 2 * t
        b.stampBall(c + orbit * Math.cos(a), r + (h - 2 * r) * t, c + orbit * Math.sin(a), r, R_PRIMARY)
      }
      return b
    },
  )
}

function doubleHelix(): ShapeDef {
  return shapeMeta(
    'double-helix',
    'Double helix',
    'curves',
    'Two intertwined strands with optional rungs.',
    'A DNA-style double helix. Add rungs to tie the two strands together at regular intervals — great for sci-fi towers and magical staircases.',
    [
      intParam('diameter', 'Orbit diameter', 48, 8, 256, { group: 'Dimensions' }),
      intParam('height', 'Height', 64, 8, 256),
      intParam('tube', 'Strand diameter', 6, 2, 48),
      floatParam('turns', 'Turns', 3, 0.5, 8, { step: 0.25, group: 'Style' }),
      boolParam('rungs', 'Add rungs', true, { group: 'Style' }),
      boolParam('clockwise', 'Clockwise', true, { group: 'Style' }),
    ],
    roles(
      ['primary', 'Strands', 'minecraft:smooth_stone'],
      ['accent', 'Rungs', 'minecraft:sea_lantern'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 8, 256)
      const tube = Math.min(clamp(num(ctx, 'tube'), 2, 48), d - 2)
      const turns = clamp(num(ctx, 'turns'), 0.5, 8)
      const rungs = flag(ctx, 'rungs')
      const cw = flag(ctx, 'clockwise')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const orbit = Math.max(1, (d - tube) / 2)
      const r = tube / 2
      const steps = Math.max(320, Math.ceil((turns * Math.PI * 2 * orbit) / 0.5))
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const a = (cw ? 1 : -1) * turns * Math.PI * 2 * t
        const y = r + (h - 2 * r) * t
        const x = c + orbit * Math.cos(a)
        const z = c + orbit * Math.sin(a)
        b.stampBall(x, y, z, r, R_PRIMARY)
        b.stampBall(c - (x - c), y, c - (z - c), r, R_PRIMARY)
        if (rungs && i > 0 && i % Math.max(8, Math.floor(steps / (turns * 8))) === 0) {
          b.stampLine(x, y, z, c - (x - c), y, c - (z - c), 0.7, R_ACCENT, 0.5)
        }
      }
      return b
    },
  )
}

function spiralStair(): ShapeDef {
  return shapeMeta(
    'spiral-stair',
    'Spiral stair',
    'curves',
    'A walkable helical staircase with a central pole.',
    'A helical tread that rises one block per layer, wrapped around a solid pole. Add the low railing for a ready-to-build tower stair.',
    [
      intParam('diameter', 'Outer diameter', 48, 8, 256, { group: 'Dimensions' }),
      intParam('height', 'Height', 64, 4, 256),
      floatParam('turns', 'Turns', 3, 0.5, 8, { step: 0.25 }),
      intParam('pole', 'Pole diameter', 6, 2, 32),
      intParam('arc', 'Tread arc', 30, 10, 60, { unit: '°', group: 'Style' }),
      boolParam('clockwise', 'Clockwise', true, { group: 'Style' }),
      boolParam('rail', 'Low railing', false, { group: 'Style' }),
    ],
    roles(
      ['primary', 'Treads', 'minecraft:smooth_stone'],
      ['accent', 'Pole & rail', 'minecraft:gold_block'],
    ),
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 8, 256)
      const h = clamp(num(ctx, 'height'), 4, 256)
      const turns = clamp(num(ctx, 'turns'), 0.5, 8)
      const pole = Math.min(clamp(num(ctx, 'pole'), 2, 32), d - 2)
      const arc = (clamp(num(ctx, 'arc'), 10, 60) * Math.PI) / 180
      const cw = flag(ctx, 'clockwise')
      const rail = flag(ctx, 'rail')
      const b = builderFor(ctx, d, h, d)
      const c = d / 2
      const R = d / 2
      const poleR = pole / 2
      for (let y = 0; y < h; y++) {
        for (let z = 0; z < d; z++) {
          for (let x = 0; x < d; x++) {
            const dx = x + 0.5 - c
            const dz = z + 0.5 - c
            const rho = Math.hypot(dx, dz)
            if (rho <= poleR) {
              b.setFull(x, y, z, R_ACCENT)
              continue
            }
            if (rho > R) continue
            const a = (cw ? 1 : -1) * turns * Math.PI * 2 * (y / Math.max(1, h - 1))
            let diff = Math.atan2(dz, dx) - a
            diff = Math.atan2(Math.sin(diff), Math.cos(diff))
            if (Math.abs(diff) <= arc / 2) b.setFull(x, y, z, R_PRIMARY)
            if (rail && Math.abs(diff) <= 0.16 && rho > R - 1.2 && y + 1 < h) {
              b.setFull(x, y + 1, z, R_ACCENT)
            }
          }
        }
      }
      return b
    },
  )
}

function mobius(): ShapeDef {
  return shapeMeta(
    'mobius',
    'Möbius ring',
    'curves',
    'A one-sided ribbon that twists through itself.',
    'A true Möbius strip built from a swept surface. Use the half-twist for the classic single-sided loop, or a full twist for an orientable band.',
    [
      intParam('diameter', 'Diameter', 48, 12, 200, { group: 'Dimensions' }),
      intParam('width', 'Ribbon width', 12, 3, 48),
      intParam('thickness', 'Ribbon thickness', 2, 1, 8),
      selectParam(
        'twist',
        'Twist',
        'half',
        [
          { value: 'half', label: 'Half twist' },
          { value: 'full', label: 'Full twist' },
        ],
        { group: 'Style' },
      ),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 12, 200)
      const width = Math.min(clamp(num(ctx, 'width'), 3, 48), d * 0.55)
      const thickness = clamp(num(ctx, 'thickness'), 1, 8)
      const k = str(ctx, 'twist') === 'full' ? 2 : 1
      const H = Math.ceil(width + thickness + 2)
      const b = builderFor(ctx, d, H, d)
      const cx = d / 2
      const cz = d / 2
      const cy = H / 2
      const R = Math.max(2, d / 2 - width / 2 - thickness / 2 - 1)
      const r = Math.max(0.5, thickness / 2)
      const nu = Math.max(320, Math.ceil((Math.PI * 2 * R) / 0.45))
      const nv = Math.max(4, Math.ceil(width / 0.55))
      for (let i = 0; i < nu; i++) {
        const u = (i / nu) * Math.PI * 2
        const cu = Math.cos(u)
        const su = Math.sin(u)
        for (let j = 0; j <= nv; j++) {
          const v = -width / 2 + (j / nv) * width
          const half = (k * u) / 2
          const rad = R + v * Math.cos(half)
          b.stampBall(cx + rad * cu, cy + v * Math.sin(half), cz + rad * su, r, R_PRIMARY)
        }
      }
      return b
    },
  )
}

function torusKnot(): ShapeDef {
  return shapeMeta(
    'torus-knot',
    'Torus knot',
    'curves',
    'Interlocking knot loops on a doughnut.',
    'A (p, q) torus knot swept with a round tube. Coprime pairs make a single elegant loop; other pairs add multiple intertwined strands.',
    [
      intParam('diameter', 'Diameter', 64, 16, 256, { group: 'Dimensions' }),
      intParam('p', 'P wraps', 2, 2, 7, { group: 'Style' }),
      intParam('q', 'Q wraps', 3, 1, 7, { group: 'Style' }),
      intParam('tube', 'Tube diameter', 6, 2, 32),
    ],
    ROLES_STONE,
    (ctx) => {
      const d = clamp(num(ctx, 'diameter'), 16, 256)
      const p = Math.round(clamp(num(ctx, 'p'), 2, 7))
      const q = Math.round(clamp(num(ctx, 'q'), 1, 7))
      const tube = clamp(num(ctx, 'tube'), 2, 32)
      const mr = Math.max(2.5, d * 0.16)
      const R = Math.max(2, d / 2 - tube / 2 - mr)
      const H = Math.ceil(2 * mr + tube + 2)
      const b = builderFor(ctx, d, H, d)
      const cx = d / 2
      const cz = d / 2
      const cy = H / 2
      const r = tube / 2
      const steps = Math.max(1600, 260 * (p + q))
      for (let i = 0; i < steps; i++) {
        const u = (i / steps) * Math.PI * 2
        const rr = R + mr * Math.cos(q * u)
        b.stampBall(cx + rr * Math.cos(p * u), cy + mr * Math.sin(q * u), cz + rr * Math.sin(p * u), r, R_PRIMARY)
      }
      return b
    },
  )
}

function waveWall(): ShapeDef {
  return shapeMeta(
    'wave-wall',
    'Wave wall',
    'curves',
    'A serpentine wall for organic builds.',
    'A vertical wall following a sine curve. Tune the amplitude and wave count to build flowing facades, garden walls and amphitheatre backdrops.',
    [
      intParam('width', 'Length', 64, 8, 256, { group: 'Dimensions' }),
      intParam('height', 'Height', 24, 2, 128),
      intParam('thickness', 'Wall thickness', 5, 1, 32),
      floatParam('waves', 'Waves', 2, 0.25, 6, { step: 0.25 }),
      intParam('amplitude', 'Amplitude', 8, 0, 64),
    ],
    ROLES_STONE,
    (ctx) => {
      const w = clamp(num(ctx, 'width'), 8, 256)
      const h = clamp(num(ctx, 'height'), 2, 128)
      const thick = clamp(num(ctx, 'thickness'), 1, 32)
      const waves = clamp(num(ctx, 'waves'), 0.25, 6)
      const amp = clamp(num(ctx, 'amplitude'), 0, 64)
      const zd = Math.max(4, Math.ceil(2 * amp + thick + 2))
      const b = builderFor(ctx, w, h, zd)
      const cz = zd / 2
      b.rasterize((x, _y, z) => {
        const center = cz + amp * Math.sin((x / w) * Math.PI * 2 * waves)
        if (Math.abs(z - center) > thick / 2) return 0
        return R_PRIMARY
      })
      return b
    },
  )
}

export const CURVE_SHAPES: ShapeDef[] = [
  helix(),
  doubleHelix(),
  spiralStair(),
  mobius(),
  torusKnot(),
  waveWall(),
]
