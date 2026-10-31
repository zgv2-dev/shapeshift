import type { MaterialSet } from './types'

export type BlockGroup = 'Stone' | 'Wood' | 'Mineral' | 'Colour' | 'Glass & light'

export interface BlockDef {
  id: string
  label: string
  color: string
  group: BlockGroup
  /** Matching slab block. Missing when the block has no slab variant. */
  slab?: string
  transparent?: boolean
}

export const BLOCKS: BlockDef[] = [
  // Stone
  { id: 'minecraft:smooth_stone', label: 'Smooth stone', color: '#c8c4b9', group: 'Stone', slab: 'minecraft:smooth_stone_slab' },
  { id: 'minecraft:stone', label: 'Stone', color: '#8c8c86', group: 'Stone', slab: 'minecraft:stone_slab' },
  { id: 'minecraft:cobblestone', label: 'Cobblestone', color: '#7b7a75', group: 'Stone', slab: 'minecraft:cobblestone_slab' },
  { id: 'minecraft:stone_bricks', label: 'Stone bricks', color: '#7a7973', group: 'Stone', slab: 'minecraft:stone_brick_slab' },
  { id: 'minecraft:polished_andesite', label: 'Polished andesite', color: '#8b8b86', group: 'Stone', slab: 'minecraft:polished_andesite_slab' },
  { id: 'minecraft:deepslate_bricks', label: 'Deepslate bricks', color: '#4b4b4f', group: 'Stone', slab: 'minecraft:deepslate_brick_slab' },
  { id: 'minecraft:deepslate_tiles', label: 'Deepslate tiles', color: '#37383b', group: 'Stone', slab: 'minecraft:deepslate_tile_slab' },
  { id: 'minecraft:blackstone', label: 'Blackstone', color: '#302c32', group: 'Stone', slab: 'minecraft:blackstone_slab' },
  { id: 'minecraft:sandstone', label: 'Sandstone', color: '#d9cba4', group: 'Stone', slab: 'minecraft:sandstone_slab' },
  { id: 'minecraft:red_sandstone', label: 'Red sandstone', color: '#b96a3e', group: 'Stone', slab: 'minecraft:red_sandstone_slab' },
  { id: 'minecraft:quartz_block', label: 'Quartz', color: '#ece6dc', group: 'Stone', slab: 'minecraft:quartz_slab' },
  { id: 'minecraft:smooth_quartz', label: 'Smooth quartz', color: '#e9e2d6', group: 'Stone', slab: 'minecraft:smooth_quartz_slab' },
  { id: 'minecraft:calcite', label: 'Calcite', color: '#d9d8d1', group: 'Stone' },
  { id: 'minecraft:prismarine_bricks', label: 'Prismarine bricks', color: '#65968b', group: 'Stone', slab: 'minecraft:prismarine_brick_slab' },
  { id: 'minecraft:dark_prismarine', label: 'Dark prismarine', color: '#38675e', group: 'Stone', slab: 'minecraft:dark_prismarine_slab' },
  { id: 'minecraft:purpur_block', label: 'Purpur', color: '#a97baa', group: 'Stone', slab: 'minecraft:purpur_slab' },
  { id: 'minecraft:bricks', label: 'Bricks', color: '#9a5b4b', group: 'Stone', slab: 'minecraft:brick_slab' },
  { id: 'minecraft:mud_bricks', label: 'Mud bricks', color: '#5d463a', group: 'Stone', slab: 'minecraft:mud_brick_slab' },
  { id: 'minecraft:cut_copper', label: 'Cut copper', color: '#b96b4c', group: 'Mineral', slab: 'minecraft:cut_copper_slab' },
  { id: 'minecraft:oxidized_cut_copper', label: 'Oxidised copper', color: '#6b9e8e', group: 'Mineral', slab: 'minecraft:oxidized_cut_copper_slab' },
  { id: 'minecraft:iron_block', label: 'Iron', color: '#d7d7d5', group: 'Mineral' },
  { id: 'minecraft:gold_block', label: 'Gold', color: '#f0c94a', group: 'Mineral' },
  { id: 'minecraft:emerald_block', label: 'Emerald', color: '#42c56a', group: 'Mineral' },
  { id: 'minecraft:sea_lantern', label: 'Sea lantern', color: '#c8e7d8', group: 'Mineral' },
  { id: 'minecraft:snow_block', label: 'Snow', color: '#f2f7f4', group: 'Mineral' },
  { id: 'minecraft:packed_ice', label: 'Packed ice', color: '#8eb9d9', group: 'Mineral' },
  { id: 'minecraft:blue_ice', label: 'Blue ice', color: '#74a8e6', group: 'Mineral' },

  // Wood
  { id: 'minecraft:oak_planks', label: 'Oak planks', color: '#b48a52', group: 'Wood', slab: 'minecraft:oak_slab' },
  { id: 'minecraft:spruce_planks', label: 'Spruce planks', color: '#6d4d2e', group: 'Wood', slab: 'minecraft:spruce_slab' },
  { id: 'minecraft:dark_oak_planks', label: 'Dark oak planks', color: '#3e2c1b', group: 'Wood', slab: 'minecraft:dark_oak_slab' },
  { id: 'minecraft:birch_planks', label: 'Birch planks', color: '#d6c69a', group: 'Wood', slab: 'minecraft:birch_slab' },
  { id: 'minecraft:cherry_planks', label: 'Cherry planks', color: '#d9a69f', group: 'Wood', slab: 'minecraft:cherry_slab' },
  { id: 'minecraft:bamboo_planks', label: 'Bamboo planks', color: '#c4a963', group: 'Wood', slab: 'minecraft:bamboo_slab' },
  { id: 'minecraft:crimson_planks', label: 'Crimson planks', color: '#6d3b50', group: 'Wood', slab: 'minecraft:crimson_slab' },
  { id: 'minecraft:warped_planks', label: 'Warped planks', color: '#397066', group: 'Wood', slab: 'minecraft:warped_slab' },

  // Glass & light
  { id: 'minecraft:glass', label: 'Glass', color: '#b7dce0', group: 'Glass & light', transparent: true },
  { id: 'minecraft:tinted_glass', label: 'Tinted glass', color: '#3d4245', group: 'Glass & light', transparent: true },
  { id: 'minecraft:glowstone', label: 'Glowstone', color: '#e5c37a', group: 'Glass & light' },
  { id: 'minecraft:shroomlight', label: 'Shroomlight', color: '#e89954', group: 'Glass & light' },
  { id: 'minecraft:white_stained_glass', label: 'White glass', color: '#e6ecea', group: 'Glass & light', transparent: true },
  { id: 'minecraft:lime_stained_glass', label: 'Lime glass', color: '#8fce62', group: 'Glass & light', transparent: true },
  { id: 'minecraft:red_stained_glass', label: 'Red glass', color: '#b14c4c', group: 'Glass & light', transparent: true },
  { id: 'minecraft:blue_stained_glass', label: 'Blue glass', color: '#5d76bf', group: 'Glass & light', transparent: true },

  // Colour
  { id: 'minecraft:white_concrete', label: 'White concrete', color: '#cfd5d1', group: 'Colour' },
  { id: 'minecraft:black_concrete', label: 'Black concrete', color: '#202224', group: 'Colour' },
  { id: 'minecraft:red_concrete', label: 'Red concrete', color: '#a52a2d', group: 'Colour' },
  { id: 'minecraft:lime_concrete', label: 'Lime concrete', color: '#6fbf3a', group: 'Colour' },
  { id: 'minecraft:orange_terracotta', label: 'Orange terracotta', color: '#a9552f', group: 'Colour' },
  { id: 'minecraft:red_terracotta', label: 'Red terracotta', color: '#8e3b2f', group: 'Colour' },
  { id: 'minecraft:white_wool', label: 'White wool', color: '#e9ece5', group: 'Colour' },
  { id: 'minecraft:black_wool', label: 'Black wool', color: '#232526', group: 'Colour' },
  { id: 'minecraft:moss_block', label: 'Moss', color: '#5a7738', group: 'Colour' },
  { id: 'minecraft:clay', label: 'Clay', color: '#a4a7b7', group: 'Colour' },
  { id: 'minecraft:honeycomb_block', label: 'Honeycomb', color: '#d69f3c', group: 'Colour' },
]

export const BLOCK_MAP: Map<string, BlockDef> = new Map(BLOCKS.map((b) => [b.id, b]))

export const BLOCK_GROUPS: BlockGroup[] = ['Stone', 'Wood', 'Mineral', 'Colour', 'Glass & light']

export const AIR: BlockDef = {
  id: 'minecraft:air',
  label: 'Air',
  color: '#000000',
  group: 'Stone',
}

export function getBlock(id: string): BlockDef {
  return BLOCK_MAP.get(id) ?? BLOCK_MAP.get(DEFAULT_MATERIALS.primary) ?? AIR
}

export function blockColor(id: string): string {
  if (id === 'minecraft:air') return 'transparent'
  return getBlock(id).color
}

export function slabFor(id: string): string | undefined {
  return BLOCK_MAP.get(id)?.slab
}

export const DEFAULT_MATERIALS: MaterialSet = {
  primary: 'minecraft:smooth_stone',
  accent: 'minecraft:glass',
  detail: 'minecraft:gold_block',
}
