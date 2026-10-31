import type {
  BoolParam,
  GenerationContext,
  NumberParam,
  ParamDef,
  ParamValue,
  RoleDef,
  RoleKey,
  SelectParam,
  ShapeCategory,
} from '../types'

export const R_PRIMARY = 1
export const R_ACCENT = 2
export const R_DETAIL = 3

interface ParamOpts {
  group?: string
  hint?: string
  unit?: string
  showIf?: { key: string; equals: ParamValue }
  step?: number
}

export function intParam(
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
  opts: ParamOpts = {},
): NumberParam {
  return {
    kind: 'number',
    key,
    label,
    default: def,
    min,
    max,
    step: opts.step ?? 1,
    integer: true,
    group: opts.group ?? 'Dimensions',
    hint: opts.hint,
    unit: opts.unit ?? 'blocks',
    showIf: opts.showIf,
  }
}

export function floatParam(
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
  opts: ParamOpts = {},
): NumberParam {
  return {
    kind: 'number',
    key,
    label,
    default: def,
    min,
    max,
    step: opts.step ?? 0.05,
    integer: false,
    group: opts.group ?? 'Dimensions',
    hint: opts.hint,
    unit: opts.unit,
    showIf: opts.showIf,
  }
}

export function boolParam(
  key: string,
  label: string,
  def: boolean,
  opts: ParamOpts = {},
): BoolParam {
  return {
    kind: 'bool',
    key,
    label,
    default: def,
    group: opts.group ?? 'Style',
    hint: opts.hint,
    showIf: opts.showIf,
  }
}

export function selectParam(
  key: string,
  label: string,
  def: string,
  options: { value: string; label: string }[],
  opts: ParamOpts = {},
): SelectParam {
  return {
    kind: 'select',
    key,
    label,
    default: def,
    options,
    group: opts.group ?? 'Style',
    hint: opts.hint,
    showIf: opts.showIf,
  }
}

export function roles(
  ...entries: [RoleKey, string, string][]
): RoleDef[] {
  return entries.map(([key, label, def]) => ({ key, label, default: def }))
}

export const ROLES_STONE = roles(['primary', 'Main block', 'minecraft:smooth_stone'])
export const ROLES_STONE_ACCENT = roles(
  ['primary', 'Main block', 'minecraft:smooth_stone'],
  ['accent', 'Accent', 'minecraft:glass'],
)
export const ROLES_STONE_DETAIL = roles(
  ['primary', 'Main block', 'minecraft:smooth_stone'],
  ['accent', 'Accent', 'minecraft:glass'],
  ['detail', 'Detail', 'minecraft:gold_block'],
)

export function num(ctx: GenerationContext, key: string): number {
  const v = ctx.p[key]
  return typeof v === 'number' ? v : Number(v)
}

export function flag(ctx: GenerationContext, key: string): boolean {
  return Boolean(ctx.p[key])
}

export function str(ctx: GenerationContext, key: string): string {
  return String(ctx.p[key])
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function shapeMeta(
  id: string,
  name: string,
  category: ShapeCategory,
  tagline: string,
  description: string,
  params: ParamDef[],
  roles: RoleDef[],
  generate: import('../types').ShapeDef['generate'],
): import('../types').ShapeDef {
  return { id, name, category, tagline, description, params, roles, generate }
}

export function hollowTest(
  insideOuter: (x: number, y: number, z: number) => boolean,
  insideInner: (x: number, y: number, z: number) => boolean,
  hollow: boolean,
): (x: number, y: number, z: number) => number {
  return (x, y, z) => {
    if (!insideOuter(x, y, z)) return 0
    if (hollow && insideInner(x, y, z)) return 0
    return R_PRIMARY
  }
}
