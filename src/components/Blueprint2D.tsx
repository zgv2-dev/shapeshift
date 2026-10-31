import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Ghost, Maximize, Minus, Plus } from 'lucide-react'
import { useStore } from '../state/store'
import { downloadBlob, modelFileName } from '../core/export/download'
import type { BlockState, VoxelModel } from '../core/types'
import { ATLAS_COLS, TILE_SIZE, tileIndicesForState } from '../three/textures'

interface Hover {
  x: number
  z: number
  px: number
  py: number
  block: BlockState
}

function pretty(name: string): string {
  return name.replace(/^minecraft:/, '').replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function symmetryOf(model: VoxelModel, layer: number) {
  const [nx, , nz] = model.dims
  const base = layer * nz * nx
  const occupied = (x: number, z: number) => model.data[base + z * nx + x] !== 0
  let xSym = true
  let zSym = true
  let quadrant = 0
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      if (!occupied(x, z)) continue
      if (x < nx / 2 && z < nz / 2) quadrant++
      if (xSym && !occupied(nx - 1 - x, z)) xSym = false
      if (zSym && !occupied(x, nz - 1 - z)) zSym = false
    }
  }
  return { xSym, zSym, quadrant }
}

export function Blueprint2D() {
  const model = useStore((s) => s.model)
  const layer = useStore((s) => s.layer)
  const ghost = useStore((s) => s.ghost)
  const mode = useStore((s) => s.mode)
  const worldOrigin = useStore((s) => s.worldOrigin)
  const pngNonce = useStore((s) => s.pngNonce)
  const atlas = useStore((s) => s.atlas)
  const textures = useStore((s) => s.textures)
  const showToast = useStore((s) => s.showToast)
  const setGhost = useStore((s) => s.setGhost)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState<Hover | null>(null)
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fittedKey = useRef('')
  const [guide, setGuide] = useState(true)
  const [follow, setFollow] = useState(true)
  const lastPng = useRef(0)

  const nx = model?.dims[0] ?? 0
  const nz = model?.dims[2] ?? 0
  const top = model ? model.perLayer.reduce((acc, l, i) => (l.items > 0 ? i : acc), 0) : 0
  const stat = model?.perLayer[layer]
  const sym = useMemo(() => (model ? symmetryOf(model, layer) : null), [model, layer])

  const bounds = useMemo(() => {
    if (!model) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
    const [mx, , mz] = model.dims
    if (!follow) return { minX: 0, maxX: mx - 1, minZ: 0, maxZ: mz - 1 }
    let minX = mx
    let maxX = -1
    let minZ = mz
    let maxZ = -1
    const base = layer * mz * mx
    for (let z = 0; z < mz; z++) {
      for (let x = 0; x < mx; x++) {
        if (model.data[base + z * mx + x] === 0) continue
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
      }
    }
    if (maxX < 0) return { minX: 0, maxX: mx - 1, minZ: 0, maxZ: mz - 1 }
    const pad = Math.max(3, Math.round(Math.min(mx, mz) * 0.05))
    minX = Math.max(0, minX - pad)
    maxX = Math.min(mx - 1, maxX + pad)
    minZ = Math.max(0, minZ - pad)
    maxZ = Math.min(mz - 1, maxZ + pad)
    const MIN_SPAN = 14
    const grow = (lo: number, hi: number, max: number): [number, number] => {
      const span = hi - lo + 1
      if (span >= MIN_SPAN) return [lo, hi]
      const extra = MIN_SPAN - span
      let nlo = Math.max(0, lo - Math.floor(extra / 2))
      let nhi = Math.min(max, hi + Math.ceil(extra / 2))
      if (nhi - nlo + 1 < MIN_SPAN) {
        if (nlo === 0) nhi = Math.min(max, MIN_SPAN - 1)
        else nlo = Math.max(0, nhi - MIN_SPAN + 1)
      }
      return [nlo, nhi]
    }
    ;[minX, maxX] = grow(minX, maxX, mx - 1)
    ;[minZ, maxZ] = grow(minZ, maxZ, mz - 1)
    return { minX, maxX, minZ, maxZ }
  }, [model, layer, follow])

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!model) return
    const key = model.dims.join('x')
    if (fittedKey.current !== key || follow) {
      fittedKey.current = key
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }, [model, layer, follow])

  const geometry = useMemo(() => {
    if (!model) return null
    const padX = 86
    const padTop = 148
    const padBottom = 118
    const bw = bounds.maxX - bounds.minX + 1
    const bh = bounds.maxZ - bounds.minZ + 1
    const availH = Math.max(80, size.h - padTop - padBottom)
    const base = Math.max(1, Math.min((size.w - padX * 2) / bw, availH / bh))
    const cell = base * zoom
    const gridW = bw * cell
    const gridH = bh * cell
    const ox = (size.w - gridW) / 2 - bounds.minX * cell + pan.x
    const oy = padTop + (availH - gridH) / 2 - bounds.minZ * cell + pan.y
    return {
      cell,
      ox,
      oy,
      gridW,
      gridH,
      base,
      frameLeft: ox + bounds.minX * cell,
      frameTop: oy + bounds.minZ * cell,
      frameRight: ox + (bounds.maxX + 1) * cell,
      frameBottom: oy + (bounds.maxZ + 1) * cell,
    }
  }, [model, bounds, size, zoom, pan])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !model || !geometry) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = size.w
    const h = size.h
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.8)
    bg.addColorStop(0, '#111712')
    bg.addColorStop(1, '#090c0a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    const { cell, ox, oy, frameLeft, frameTop, frameRight, frameBottom } = geometry
    const frameW = frameRight - frameLeft
    const frameH = frameBottom - frameTop
    const [nx0, , nz0] = model.dims
    const baseIndex = layer * nz0 * nx0
    const belowIndex = (layer - 1) * nz0 * nx0
    const showGrid = cell >= 4
    const showLabels = cell >= 3

    // grid bed
    ctx.fillStyle = '#0c110d'
    ctx.fillRect(frameLeft, frameTop, frameW, frameH)

    ctx.save()
    ctx.beginPath()
    ctx.rect(frameLeft, frameTop, frameW, frameH)
    ctx.clip()

    // ghost of the layer below
    if (ghost && layer > 0) {
      ctx.globalAlpha = 0.14
      for (let z = 0; z < nz0; z++) {
        for (let x = 0; x < nx0; x++) {
          const p = model.data[belowIndex + z * nx0 + x]
          if (p === 0) continue
          const state = model.palette[p]
          ctx.fillStyle = state.color ?? '#8c8c86'
          ctx.fillRect(ox + x * cell + 0.5, oy + z * cell + 0.5, Math.max(1, cell - 1), Math.max(1, cell - 1))
        }
      }
      ctx.globalAlpha = 1
    }

    // block cells
    const counts = new Map<number, number>()
    for (let z = 0; z < nz0; z++) {
      for (let x = 0; x < nx0; x++) {
        const p = model.data[baseIndex + z * nx0 + x]
        if (p === 0) continue
        counts.set(p, (counts.get(p) ?? 0) + 1)
        const state = model.palette[p]
        const gx = ox + x * cell
        const gy = oy + z * cell
        const tiles = textures && atlas && cell >= 7 ? tileIndicesForState(state.name) : null
        if (tiles && atlas) {
          ctx.globalAlpha = state.transparent ? 0.8 : 1
          ctx.imageSmoothingEnabled = false
          const tile = state.kind === 'top' ? tiles.top : tiles.top
          const sx = (tile % ATLAS_COLS) * TILE_SIZE
          const sy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE
          if (state.kind === 'bottom') {
            ctx.save()
            ctx.beginPath()
            ctx.rect(gx, gy + cell / 2, cell, cell / 2)
            ctx.clip()
            ctx.drawImage(atlas.canvas, sx, sy, TILE_SIZE, TILE_SIZE, gx, gy, cell, cell)
            ctx.restore()
          } else if (state.kind === 'top') {
            ctx.save()
            ctx.beginPath()
            ctx.rect(gx, gy, cell, cell / 2)
            ctx.clip()
            ctx.drawImage(atlas.canvas, sx, sy, TILE_SIZE, TILE_SIZE, gx, gy, cell, cell)
            ctx.restore()
          } else {
            ctx.drawImage(atlas.canvas, sx, sy, TILE_SIZE, TILE_SIZE, gx, gy, cell, cell)
          }
          ctx.imageSmoothingEnabled = true
        } else {
          ctx.globalAlpha = state.transparent ? 0.62 : 0.96
          ctx.fillStyle = state.color ?? '#8c8c86'
          if (state.kind === 'bottom') {
            ctx.fillRect(gx + 0.5, gy + cell / 2, Math.max(1, cell - 1), Math.max(1, cell / 2 - 0.5))
          } else if (state.kind === 'top') {
            ctx.fillRect(gx + 0.5, gy + 0.5, Math.max(1, cell - 1), Math.max(1, cell / 2 - 0.5))
          } else {
            ctx.fillRect(gx + 0.5, gy + 0.5, Math.max(1, cell - 1), Math.max(1, cell - 1))
          }
          if (cell >= 7) {
            ctx.globalAlpha = 0.1
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(gx + 1, gy + 1, Math.max(1, cell - 2), 1)
          }
        }
      }
    }
    ctx.globalAlpha = 1

    // grid
    if (showGrid) {
      const every = 8
      ctx.lineWidth = 1
      for (let x = 0; x <= nx0; x++) {
        const major = x % every === 0
        if (!major && cell < 7) continue
        ctx.strokeStyle = major ? 'rgba(196,255,106,0.11)' : 'rgba(255,255,255,0.035)'
        ctx.beginPath()
        ctx.moveTo(Math.round(ox + x * cell) + 0.5, oy)
        ctx.lineTo(Math.round(ox + x * cell) + 0.5, frameBottom)
        ctx.stroke()
      }
      for (let z = 0; z <= nz0; z++) {
        const major = z % every === 0
        if (!major && cell < 7) continue
        ctx.strokeStyle = major ? 'rgba(196,255,106,0.11)' : 'rgba(255,255,255,0.035)'
        ctx.beginPath()
        ctx.moveTo(frameLeft, Math.round(oy + z * cell) + 0.5)
        ctx.lineTo(frameRight, Math.round(oy + z * cell) + 0.5)
        ctx.stroke()
      }
    }

    // centre guides
    if (guide) {
      const cxp = ox + (nx0 / 2) * cell
      const czp = oy + (nz0 / 2) * cell
      ctx.save()
      ctx.strokeStyle = 'rgba(217,255,107,0.3)'
      ctx.setLineDash([4, 6])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cxp, frameTop)
      ctx.lineTo(cxp, frameBottom)
      ctx.moveTo(frameLeft, czp)
      ctx.lineTo(frameRight, czp)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()

    // row and column totals, spaced so they never collide
    if (showLabels) {
      ctx.font = `600 ${Math.max(8, Math.min(10, cell * 0.8))}px "JetBrains Mono Variable", monospace`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const zStep = Math.max(1, Math.ceil(28 / cell))
      ctx.fillStyle = '#6f7f66'
      for (let z = 0; z < nz0; z += zStep) {
        let total = 0
        for (let x = 0; x < nx0; x++) if (model.data[baseIndex + z * nx0 + x] !== 0) total++
        if (total > 0) ctx.fillText(String(total), frameLeft - 8, oy + (z + 0.5) * cell)
      }
      ctx.textAlign = 'center'
      const xStep = Math.max(1, Math.ceil(28 / cell))
      for (let x = 0; x < nx0; x += xStep) {
        let total = 0
        for (let z = 0; z < nz0; z++) if (model.data[baseIndex + z * nx0 + x] !== 0) total++
        if (total > 0) ctx.fillText(String(total), ox + (x + 0.5) * cell, frameBottom + 10)
      }
    }

    // outer frame
    ctx.strokeStyle = 'rgba(217,255,107,0.22)'
    ctx.lineWidth = 1
    ctx.strokeRect(frameLeft - 0.5, frameTop - 0.5, frameW + 1, frameH + 1)

    // hover
    if (hover) {
      const gx = ox + hover.x * cell
      const gy = oy + hover.z * cell
      ctx.strokeStyle = '#d9ff6b'
      ctx.lineWidth = 1.5
      ctx.strokeRect(gx + 0.5, gy + 0.5, Math.max(2, cell - 1), Math.max(2, cell - 1))
    }

    // axis labels
    if (cell >= 8) {
      const axisStep = Math.max(8, Math.ceil(48 / cell / 8) * 8)
      ctx.fillStyle = '#4d5b47'
      ctx.font = '600 9px "JetBrains Mono Variable", monospace'
      ctx.textAlign = 'center'
      for (let x = 0; x < nx0; x += axisStep) {
        const local = x - Math.floor(nx0 / 2)
        ctx.fillText(String(local), ox + (x + 0.5) * cell, frameTop - 8)
      }
      ctx.textAlign = 'right'
      for (let z = 0; z < nz0; z += axisStep) {
        const local = z - Math.floor(nz0 / 2)
        ctx.fillText(String(local), frameLeft - 10, oy + (z + 0.5) * cell + 3)
      }
    }
  }, [atlas, geometry, ghost, guide, hover, layer, model, size, textures])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (!geometry) return
      const rect = canvas.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      const factor = event.deltaY < 0 ? 1.12 : 0.89
      const nextZoom = Math.max(0.35, Math.min(9, zoom * factor))
      const gx = (mx - geometry.ox) / geometry.cell
      const gz = (my - geometry.oy) / geometry.cell
      const newCell = geometry.base * nextZoom
      const newOx = mx - gx * newCell
      const newOy = my - gz * newCell
      const bw = bounds.maxX - bounds.minX + 1
      const bh = bounds.maxZ - bounds.minZ + 1
      const availH = Math.max(80, size.h - 148 - 118)
      setPan({
        x: newOx - (size.w - bw * newCell) / 2 - bounds.minX * newCell,
        y: newOy - (148 + (availH - bh * newCell) / 2) - bounds.minZ * newCell,
      })
      setZoom(nextZoom)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [geometry, zoom, size, nx, nz, bounds])

  const toCell = (event: React.PointerEvent<HTMLCanvasElement>): Hover | null => {
    if (!model || !geometry) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const x = Math.floor((px - geometry.ox) / geometry.cell)
    const z = Math.floor((py - geometry.oy) / geometry.cell)
    if (x < 0 || z < 0 || x >= nx || z >= nz) return null
    const p = model.data[layer * nz * nx + z * nx + x]
    if (p === 0) return null
    return { x, z, px, py, block: model.palette[p] }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current) {
      setPan({
        x: drag.current.panX + e.clientX - drag.current.x,
        y: drag.current.panY + e.clientY - drag.current.y,
      })
      setHover(null)
      return
    }
    setHover(toCell(e))
  }
  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }

  useEffect(() => {
    if (pngNonce === 0 || pngNonce === lastPng.current) return
    lastPng.current = pngNonce
    const canvas = canvasRef.current
    if (!canvas || !model) return
    exportPng(canvas, model, layer, stat, sym, top + 1)
    showToast('Blueprint PNG downloaded')
  }, [pngNonce, model, layer, stat, sym, showToast])

  return (
    <div className={`blueprint2d ${mode === '2d' ? 'active' : ''}`} ref={wrapRef}>
      <div className="bp-head">
        <div>
          <p className="eyebrow">2D build guide</p>
          <h2>
            Layer {layer + 1}
            <span> / {top + 1}</span>
          </h2>
        </div>
        <div className="bp-stats">
          <span><b>{stat?.items ?? 0}</b> blocks</span>
          <span><b>{stat?.slabs ?? 0}</b> slabs</span>
          <span><b>{stat ? Math.ceil(stat.items / 64) : 0}</b> stacks</span>
        </div>
        <div className="bp-badges">
          {sym?.xSym ? <span className="badge">X symmetric</span> : null}
          {sym?.zSym ? <span className="badge">Z symmetric</span> : null}
          {sym?.xSym && sym?.zSym ? (
            <span className="badge lime">quadrant {sym.quadrant} · ×4</span>
          ) : null}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={dragging ? 'dragging' : ''}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { setHover(null); drag.current = null; setDragging(false) }}
        onDoubleClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
        aria-label="Top-down layer blueprint"
      />

      <div className="bp-tools">
        <button className="tool-btn" onClick={() => setZoom((z) => Math.min(9, z * 1.25))} title="Zoom in">
          <Plus size={16} />
        </button>
        <button className="tool-btn" onClick={() => setZoom((z) => Math.max(0.35, z / 1.25))} title="Zoom out">
          <Minus size={16} />
        </button>
        <button className="tool-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Fit to view">
          <Maximize size={16} />
        </button>
        <button
          className={`tool-btn ${ghost ? 'active' : ''}`}
          onClick={() => setGhost(!ghost)}
          title="Ghost the previous layer"
        >
          <Ghost size={16} />
        </button>
        <button
          className={`tool-btn ${guide ? 'active' : ''}`}
          onClick={() => setGuide(!guide)}
          title="Centre guides"
        >
          <span className="guide-icon">+</span>
        </button>
        <button
          className={`tool-btn ${follow ? 'active' : ''}`}
          onClick={() => { setFollow(!follow); setZoom(1); setPan({ x: 0, y: 0 }) }}
          title="Follow the current layer's footprint"
        >
          <span className="guide-icon">⌖</span>
        </button>
      </div>

      {hover ? (
        <div
          className="bp-hover"
          style={{ transform: `translate(${Math.min(size.w - 180, hover.px + 16)}px, ${Math.max(8, hover.py - 54)}px)` }}
        >
          <div className="mono">
            x {hover.x - Math.floor(nx / 2) + worldOrigin.x} · y {layer + worldOrigin.y} · z {hover.z - Math.floor(nz / 2) + worldOrigin.z}
          </div>
          <div>
            {pretty(hover.block.name)}
            {hover.block.kind !== 'block' ? ` · ${hover.block.kind} slab` : ''}
          </div>
        </div>
      ) : null}

      <div className="bp-hint">
        <span><b>Wheel</b> zoom</span>
        <span><b>Drag</b> pan</span>
        <span><b>Double-click</b> fit</span>
      </div>
    </div>
  )
}

function exportPng(
  canvas: HTMLCanvasElement,
  model: VoxelModel,
  layer: number,
  stat: { items: number; slabs: number; equivalents: number } | undefined,
  sym: { xSym: boolean; zSym: boolean; quadrant: number } | null,
  layerCount: number,
): void {
  const srcW = canvas.width
  const srcH = canvas.height
  const header = 130
  const footer = 120
  const targetW = Math.max(1400, srcW)
  const targetH = Math.round((srcH * targetW) / srcW) + header + footer
  const out = document.createElement('canvas')
  out.width = targetW
  out.height = targetH
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#0a0d0b'
  ctx.fillRect(0, 0, targetW, targetH)

  ctx.fillStyle = '#d9ff6b'
  ctx.fillRect(0, 0, targetW, 4)
  ctx.fillStyle = '#e9eee4'
  ctx.font = '600 34px "Space Grotesk Variable", sans-serif'
  ctx.fillText('SHAPESHIFT', 46, 62)
  ctx.fillStyle = '#7d8b74'
  ctx.font = '400 15px "Inter Variable", sans-serif'
  ctx.fillText('Minecraft build blueprint', 46, 88)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#e9eee4'
  ctx.font = '600 30px "Space Grotesk Variable", sans-serif'
  ctx.fillText(`Layer ${layer + 1} / ${layerCount}`, targetW - 46, 62)
  ctx.fillStyle = '#93a08a'
  ctx.font = '400 14px "Inter Variable", sans-serif'
  const symText = sym?.xSym && sym?.zSym ? `quadrant ${sym.quadrant} ×4` : ''
  ctx.fillText(
    [
      `${model.dims[0]} × ${model.dims[1]} × ${model.dims[2]}`,
      `${stat?.items ?? 0} blocks`,
      `${stat?.slabs ?? 0} slabs`,
      symText,
    ]
      .filter(Boolean)
      .join('  ·  '),
    targetW - 46,
    88,
  )
  ctx.textAlign = 'left'

  const maxW = targetW - 92
  const maxH = targetH - header - footer - 20
  const scale = Math.min(maxW / srcW, maxH / srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  ctx.drawImage(canvas, 46 + (maxW - dw) / 2, header, dw, dh)
  ctx.strokeStyle = 'rgba(217,255,107,0.18)'
  ctx.strokeRect(46 + (maxW - dw) / 2, header, dw, dh)

  const legendY = targetH - footer + 34
  ctx.fillStyle = '#7d8b74'
  ctx.font = '600 11px "JetBrains Mono Variable", monospace'
  ctx.fillText('PALETTE', 46, legendY - 14)
  const counts = new Map<number, number>()
  const baseIndex = layer * model.dims[0] * model.dims[2]
  for (let i = 0; i < model.dims[0] * model.dims[2]; i++) {
    const p = model.data[baseIndex + i]
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  let x = 46
  for (const [p, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9)) {
    const state = model.palette[p]
    ctx.fillStyle = state.color ?? '#8c8c86'
    ctx.fillRect(x, legendY, 14, 14)
    ctx.fillStyle = '#cfd7c8'
    ctx.font = '400 12px "Inter Variable", sans-serif'
    ctx.fillText(`${pretty(state.name)} · ${count}`, x + 21, legendY + 12)
    x += Math.max(180, ctx.measureText(`${pretty(state.name)} · ${count}`).width + 70)
    if (x > targetW - 260) break
  }
  ctx.fillStyle = '#5e6b57'
  ctx.font = '400 11px "Inter Variable", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('shapeshift · minecraft shape studio', targetW - 46, targetH - 24)

  out.toBlob((blob) => {
    if (blob) downloadBlob(blob, modelFileName(`layer-${layer + 1}`, model, '.png'))
  }, 'image/png')
}
