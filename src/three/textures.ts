import { BLOCKS, BLOCK_MAP, type BlockDef } from '../core/blocks'
import { TEXTURE_VERSION } from '../core/versions'

export const ATLAS_COLS = 16
export const ATLAS_ROWS = 16
export const TILE_SIZE = 16
export const ATLAS_PIXELS = ATLAS_COLS * TILE_SIZE

interface TextureNames {
  side: string
  top: string
  bottom: string
}

/**
 * Vanilla texture file names that differ from the block id.
 * Everything else resolves to the block id itself.
 */
const OVERRIDES: Record<string, Partial<TextureNames>> = {
  smooth_quartz: {
    side: 'quartz_block_bottom',
    top: 'quartz_block_bottom',
    bottom: 'quartz_block_bottom',
  },
  quartz_block: {
    side: 'quartz_block_side',
    top: 'quartz_block_top',
    bottom: 'quartz_block_bottom',
  },
  sandstone: {
    side: 'sandstone',
    top: 'sandstone_top',
    bottom: 'sandstone_bottom',
  },
  red_sandstone: {
    side: 'red_sandstone',
    top: 'red_sandstone_top',
    bottom: 'red_sandstone_bottom',
  },
  snow_block: { side: 'snow', top: 'snow', bottom: 'snow' },
}

function namesForBlock(block: BlockDef): TextureNames {
  const base = block.id.replace('minecraft:', '')
  const override = OVERRIDES[base] ?? {}
  return {
    side: override.side ?? base,
    top: override.top ?? override.side ?? base,
    bottom: override.bottom ?? override.side ?? base,
  }
}

export const SLAB_TO_BLOCK = new Map<string, BlockDef>()
for (const block of BLOCKS) {
  if (block.slab) SLAB_TO_BLOCK.set(block.slab, block)
}

export function blockForStateName(name: string): BlockDef | undefined {
  return BLOCK_MAP.get(name) ?? SLAB_TO_BLOCK.get(name)
}

/** Deterministic atlas slot layout, available before any network request. */
const textureNames: string[] = []
const slotByName = new Map<string, number>()
const fallbackColors = new Map<string, string>()

for (const block of BLOCKS) {
  const names = namesForBlock(block)
  for (const name of [names.side, names.top, names.bottom]) {
    if (!slotByName.has(name)) {
      slotByName.set(name, textureNames.length)
      textureNames.push(name)
      fallbackColors.set(name, block.color)
    }
  }
}

export const UNIQUE_TEXTURES: readonly string[] = textureNames
export const TEXTURE_COUNT = textureNames.length

export interface TextureTiles {
  side: number
  top: number
  bottom: number
}

export function tileIndicesForState(name: string): TextureTiles | null {
  const block = blockForStateName(name)
  if (!block) return null
  const names = namesForBlock(block)
  const side = slotByName.get(names.side)
  const top = slotByName.get(names.top)
  const bottom = slotByName.get(names.bottom)
  if (side === undefined || top === undefined || bottom === undefined) return null
  return { side, top, bottom }
}

export interface BlockAtlas {
  canvas: HTMLCanvasElement
  loaded: number
  total: number
  missing: string[]
  source: string
}

const TEXTURE_SOURCES = [
  `https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@${TEXTURE_VERSION}/assets/minecraft/textures/block/`,
  `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/${TEXTURE_VERSION}/assets/minecraft/textures/block/`,
  `https://assets.mcasset.cloud/${TEXTURE_VERSION}/assets/minecraft/textures/block/`,
]

let cachedAtlas: BlockAtlas | null = null
let loadingPromise: Promise<BlockAtlas> | null = null

export function getCachedAtlas(): BlockAtlas | null {
  return cachedAtlas
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, done: () => window.clearTimeout(timer) }
}

async function resolveSource(): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const attempts = TEXTURE_SOURCES.map(async (source) => {
      const timeout = withTimeout(5000)
      try {
        const response = await fetch(`${source}stone.png`, {
          signal: timeout.signal,
          cache: 'force-cache',
        })
        if (!response.ok) throw new Error(`Texture mirror returned ${response.status}`)
        await response.arrayBuffer()
        return source
      } finally {
        timeout.done()
      }
    })
    try {
      return await Promise.any(attempts)
    } catch {
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 500))
    }
  }
  throw new Error('No Minecraft texture mirror reachable')
}

async function fetchTexture(
  source: string,
  name: string,
): Promise<ImageBitmap | HTMLImageElement> {
  const timeout = withTimeout(10000)
  try {
    const response = await fetch(`${source}${name}.png`, {
      signal: timeout.signal,
      cache: 'force-cache',
    })
    if (!response.ok) throw new Error(`${name}: ${response.status}`)
    const blob = await response.blob()
    try {
      return await createImageBitmap(blob)
    } catch {
      const url = URL.createObjectURL(blob)
      try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Could not decode ${name}`))
          image.src = url
        })
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  } finally {
    timeout.done()
  }
}

/**
 * Download one texture per block face from a public Minecraft asset mirror matching TEXTURE_VERSION,
 * compose a 16x16 tile atlas, and return it. Missing textures get a flat fallback
 * tile so one bad file never breaks the whole atlas.
 */
export function loadBlockAtlas(
  onProgress?: (loaded: number, total: number) => void,
): Promise<BlockAtlas> {
  if (cachedAtlas) return Promise.resolve(cachedAtlas)
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const source = await resolveSource()
    const total = UNIQUE_TEXTURES.length
    let loaded = 0
    let index = 0
    const images = new Map<string, ImageBitmap | HTMLImageElement>()
    const missing: string[] = []

    const workers = Array.from({ length: 5 }, async () => {
      while (index < total) {
        const current = index++
        const name = UNIQUE_TEXTURES[current]
        try {
          const image = await fetchTexture(source, name)
          images.set(name, image)
        } catch {
          missing.push(name)
        } finally {
          loaded += 1
          onProgress?.(loaded, total)
        }
      }
    })
    await Promise.all(workers)

    if (images.size === 0) throw new Error('No textures could be loaded')

    // A couple of transient failures are common on flaky mobile connections.
    // Retry the stragglers against the other mirrors before giving up on them.
    const retry = [...missing]
    missing.length = 0
    for (const name of retry) {
      let recovered = false
      for (const mirror of TEXTURE_SOURCES) {
        if (mirror === source) continue
        try {
          images.set(name, await fetchTexture(mirror, name))
          recovered = true
          break
        } catch {
          /* try the next mirror */
        }
      }
      if (!recovered) missing.push(name)
    }

    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_PIXELS
    canvas.height = ATLAS_PIXELS
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create texture atlas')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, ATLAS_PIXELS, ATLAS_PIXELS)

    UNIQUE_TEXTURES.forEach((name, slot) => {
      const x = (slot % ATLAS_COLS) * TILE_SIZE
      const y = Math.floor(slot / ATLAS_COLS) * TILE_SIZE
      const image = images.get(name)
      if (image) {
        const width = 'width' in image ? image.width : TILE_SIZE
        const height = 'height' in image ? image.height : TILE_SIZE
        const frameHeight = Math.min(width, height)
        ctx.drawImage(image, 0, 0, width, frameHeight, x, y, TILE_SIZE, TILE_SIZE)
        if ('close' in image) image.close()
      } else {
        const color = fallbackColors.get(name) ?? '#8b8b85'
        ctx.fillStyle = color
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.fillStyle = 'rgba(0,0,0,0.14)'
        ctx.fillRect(x, y, TILE_SIZE / 2, TILE_SIZE / 2)
        ctx.fillRect(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2)
      }
    })

    const atlas: BlockAtlas = {
      canvas,
      loaded: images.size,
      total,
      missing,
      source,
    }
    cachedAtlas = atlas
    return atlas
  })().catch((error) => {
    loadingPromise = null
    throw error
  })

  return loadingPromise
}
