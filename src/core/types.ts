export type RoleKey = 'primary' | 'accent' | 'detail'

export type BlockKind = 'block' | 'bottom' | 'top'

export type MaterialSet = Record<RoleKey, string>

export type ParamValue = number | boolean | string

export type ShapeCategory = 'round' | 'solids' | 'curves' | 'structures'

export interface BaseParam {
  key: string
  label: string
  group?: string
  hint?: string
  /** Hide this control unless another param has the given value. */
  showIf?: { key: string; equals: ParamValue }
}

export interface NumberParam extends BaseParam {
  kind: 'number'
  default: number
  min: number
  max: number
  step: number
  unit?: string
  integer?: boolean
}

export interface BoolParam extends BaseParam {
  kind: 'bool'
  default: boolean
}

export interface SelectParam extends BaseParam {
  kind: 'select'
  default: string
  options: { value: string; label: string }[]
}

export type ParamDef = NumberParam | BoolParam | SelectParam

export interface RoleDef {
  key: RoleKey
  label: string
  default: string
}

export interface ShapeDef {
  id: string
  name: string
  category: ShapeCategory
  tagline: string
  description: string
  params: ParamDef[]
  roles: RoleDef[]
  generate: (ctx: GenerationContext) => import('./voxel').VoxelBuilder
}

export interface GenerationContext {
  p: Record<string, ParamValue>
  detail: boolean
  materials: MaterialSet
  roleBlockNames: [string, string, string]
}

export interface BlockState {
  name: string
  kind: BlockKind
  props?: Record<string, string>
  transparent?: boolean
  color?: string
}

export interface LayerStat {
  items: number
  equivalents: number
  full: number
  slabs: number
}

export interface ModelCounts {
  total: number
  full: number
  bottom: number
  top: number
  slabs: number
  equivalents: number
  stacks: number
  visible: number
  paletteCount: number
}

export interface VoxelModel {
  dims: [number, number, number]
  /** YZX order: (y * nz + z) * nx + x. 0 is air. */
  data: Uint8Array
  palette: BlockState[]
  counts: ModelCounts
  perLayer: LayerStat[]
}

export interface ModelPayload extends VoxelModel {
  shapeId: string
  /** Packed render blocks: x | y<<8 | z<<16 | kind<<24 | palette<<26. */
  blocks: Uint32Array
  world: { genMs: number }
}

export const ROLE_ORDER: RoleKey[] = ['primary', 'accent', 'detail']

export const ROLE_INDEX: Record<RoleKey, number> = {
  primary: 1,
  accent: 2,
  detail: 3,
}
