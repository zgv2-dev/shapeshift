import { useEffect, useRef } from 'react'
import { getBlock } from '../core/blocks'
import { useStore } from '../state/store'
import { tileIndicesForState } from '../three/textures'

interface IsoBlockProps {
  block: string
  size?: number
  className?: string
}

type Point = [number, number]

function path(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
}

/**
 * A tiny isometric Minecraft block. Faces are sampled from the runtime texture
 * atlas when it is available, with a flat-colour fallback for offline use.
 */
export function IsoBlock({ block, size = 32, className = '' }: IsoBlockProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const atlas = useStore((s) => s.atlas)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const S = Math.max(18, Math.round(size * 2))
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, S, S)
    ctx.imageSmoothingEnabled = false

    const def = getBlock(block)
    const tiles = atlas ? tileIndicesForState(block) : null
    const atlasCanvas = atlas?.canvas ?? null
    const top: Point[] = [[S / 2, 0], [S, S / 4], [S / 2, S / 2], [0, S / 4]]
    const left: Point[] = [[0, S / 4], [S / 2, S / 2], [S / 2, S], [0, S * 0.75]]
    const right: Point[] = [[S / 2, S / 2], [S, S / 4], [S, S * 0.75], [S / 2, S]]

    const drawFace = (
      points: Point[],
      transform: [number, number, number, number, number, number],
      tile: number | undefined,
      shade: number,
      fill: string,
    ): void => {
      ctx.save()
      path(ctx, points)
      ctx.clip()
      if (atlasCanvas && tile !== undefined) {
        const cols = 16
        const sx = (tile % cols) * 16
        const sy = Math.floor(tile / cols) * 16
        ctx.setTransform(...transform)
        ctx.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      } else {
        ctx.fillStyle = fill
        ctx.fillRect(0, 0, S, S)
      }
      ctx.fillStyle = `rgba(0, 0, 0, ${shade})`
      ctx.fillRect(0, 0, S, S)
      ctx.restore()
      path(ctx, points)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)'
      ctx.lineWidth = Math.max(1, S / 90)
      ctx.stroke()
    }

    const topTransform: [number, number, number, number, number, number] = [
      S / 32,
      S / 64,
      -S / 32,
      S / 64,
      S / 2,
      0,
    ]
    const leftTransform: [number, number, number, number, number, number] = [
      S / 32,
      S / 64,
      0,
      S / 32,
      0,
      S / 4,
    ]
    const rightTransform: [number, number, number, number, number, number] = [
      S / 32,
      -S / 64,
      0,
      S / 32,
      S / 2,
      S / 2,
    ]

    drawFace(top, topTransform, tiles?.top, 0.02, lighten(def.color))
    drawFace(left, leftTransform, tiles?.side, 0.25, darken(def.color, 0.45))
    drawFace(right, rightTransform, tiles?.side, 0.38, darken(def.color, 0.25))
  }, [atlas, block, size])

  return (
    <canvas
      ref={ref}
      className={`iso-block ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  if (value.length !== 6) return [150, 150, 145]
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function lighten(hex: string): string {
  const [r, g, b] = parseHex(hex)
  return `rgb(${clampByte(r * 1.08)}, ${clampByte(g * 1.08)}, ${clampByte(b * 1.08)})`
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgb(${clampByte(r * (1 - amount))}, ${clampByte(g * (1 - amount))}, ${clampByte(b * (1 - amount))})`
}
