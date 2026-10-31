import type { MaterialSet, ParamDef, ParamValue, ShapeCategory, ShapeDef } from '../types'
import { DEFAULT_MATERIALS } from '../blocks'
import { ROUND_SHAPES } from './round'
import { SOLID_SHAPES } from './solids'
import { CURVE_SHAPES } from './curves'
import { STRUCTURE_SHAPES } from './structures'

export const SHAPES: ShapeDef[] = [
  ...ROUND_SHAPES,
  ...SOLID_SHAPES,
  ...CURVE_SHAPES,
  ...STRUCTURE_SHAPES,
]

export const SHAPE_MAP: Map<string, ShapeDef> = new Map(SHAPES.map((s) => [s.id, s]))

export const CATEGORIES: { id: ShapeCategory; label: string; blurb: string }[] = [
  { id: 'round', label: 'Round', blurb: 'Spheres, domes and organic curves' },
  { id: 'solids', label: 'Solids', blurb: 'Prisms, boxes, stars and arches' },
  { id: 'curves', label: 'Curves', blurb: 'Helices, stairs and swept surfaces' },
  { id: 'structures', label: 'Structures', blurb: 'Towers, observatories and igloos' },
]

export function getShape(id: string): ShapeDef {
  return SHAPE_MAP.get(id) ?? SHAPES[0]
}

export function defaultParams(shape: ShapeDef): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const p of shape.params) out[p.key] = p.default
  return out
}

export function defaultMaterials(shape: ShapeDef): MaterialSet {
  const mats: MaterialSet = { ...DEFAULT_MATERIALS }
  for (const role of shape.roles) mats[role.key] = role.default
  return mats
}

export function paramByKey(shape: ShapeDef, key: string): ParamDef | undefined {
  return shape.params.find((p) => p.key === key)
}

export function coerceParam(def: ParamDef, raw: string | null): ParamValue | undefined {
  if (raw === null) return undefined
  if (def.kind === 'bool') return raw === '1' || raw === 'true'
  if (def.kind === 'select') {
    return def.options.some((o) => o.value === raw) ? raw : undefined
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.max(def.min, Math.min(def.max, n))
}
