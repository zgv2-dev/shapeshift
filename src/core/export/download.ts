import type { VoxelModel } from '../types'
import {
  buildBlockListCsv,
  buildCoordinatesCsv,
  buildLitematic,
  buildSchem,
  buildStructure,
} from './builders'

export type ExportFormat = 'litematic' | 'schem' | 'structure' | 'blocks' | 'coords'

export const EXPORT_LABELS: Record<ExportFormat, { label: string; ext: string; note: string }> = {
  litematic: {
    label: 'Litematica',
    ext: '.litematic',
    note: 'Best all-rounder for 1.20+; keeps slabs, stairs and block states.',
  },
  schem: {
    label: 'Sponge schematic',
    ext: '.schem',
    note: 'WorldEdit, FAWE and Amulet. The most widely supported format.',
  },
  structure: {
    label: 'Structure block',
    ext: '.nbt',
    note: 'Vanilla structure block file. Paste it with a structure block.',
  },
  blocks: {
    label: 'Block list',
    ext: '.csv',
    note: 'Shopping list with full blocks and half slabs counted separately.',
  },
  coords: {
    label: 'Coordinates',
    ext: '.csv',
    note: 'Every block with its world coordinate, offset by your build origin.',
  },
}

export async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('This browser does not support gzip compression.')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBytes(new TextEncoder().encode(text), filename, mime)
}

export function safeFileName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'shapeshift'
}

export function modelFileName(shapeId: string, model: VoxelModel, ext: string): string {
  const [x, y, z] = model.dims
  return `${safeFileName(shapeId)}-${x}x${y}x${z}${ext}`
}

export async function exportModel(
  format: ExportFormat,
  model: VoxelModel,
  shapeId: string,
  options: { name?: string; origin?: { x: number; y: number; z: number } } = {},
): Promise<void> {
  const base = modelFileName(shapeId, model, '')
  if (format === 'blocks') {
    downloadText(buildBlockListCsv(model), `${base}-blocks.csv`, 'text/csv;charset=utf-8')
    return
  }
  if (format === 'coords') {
    downloadText(
      buildCoordinatesCsv(model, options.origin),
      `${base}-coordinates.csv`,
      'text/csv;charset=utf-8',
    )
    return
  }
  let raw: Uint8Array
  if (format === 'litematic') raw = buildLitematic(model, options.name ?? 'ShapeShiftMC build')
  else if (format === 'schem') raw = buildSchem(model, options.name ?? 'ShapeShiftMC build')
  else raw = buildStructure(model)
  const zipped = await gzipBytes(raw)
  downloadBytes(zipped, `${base}${EXPORT_LABELS[format].ext}`)
}
