import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ModelPayload } from '../core/types'
import { ATLAS_COLS, tileIndicesForState } from './textures'

THREE.ColorManagement.enabled = false

type GroupId = 'baseO' | 'baseG' | 'curO' | 'curG' | 'above'

const GROUP_IDS: GroupId[] = ['baseO', 'baseG', 'curO', 'curG', 'above']

export interface HoverInfo {
  x: number
  y: number
  z: number
  kind: number
  palette: number
  label: string
  normal: { x: number; y: number; z: number }
}

export interface ViewState {
  layer: number
  buildMode: boolean
  ghost: boolean
  grid: boolean
  autoRotate: boolean
  cutaway: number
  backdrop: 'studio' | 'sky' | 'nether' | 'end'
  active: boolean
  editMode: boolean
  origin: { x: number; y: number; z: number }
}

interface ViewerOptions {
  onToast: (message: string) => void
  onEdit?: (hit: HoverInfo) => void
}

const BACKDROPS = {
  studio: { bg: '#0a0d0b', fog: '#0a0d0b', grid: 0x2b3527, minor: 0x161d17 },
  sky: { bg: '#16242e', fog: '#16242e', grid: 0x36505b, minor: 0x1b2b34 },
  nether: { bg: '#241011', fog: '#241011', grid: 0x4b2a24, minor: 0x281614 },
  end: { bg: '#171124', fog: '#171124', grid: 0x3a2f52, minor: 0x1e192d },
} as const

const VERT = `
attribute vec3 aOffset;
attribute float aKind;
attribute vec3 aColor;
attribute vec3 aTiles;

varying vec3 vColor;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorld;
varying float vJitter;
varying vec3 vTiles;

void main() {
  float sy = aKind < 0.5 ? 1.0 : 0.5;
  float yo = aKind < 0.5 ? 0.0 : (aKind < 1.5 ? -0.25 : 0.25);
  vec3 p = position * vec3(1.0, sy, 1.0) + aOffset + vec3(0.0, yo, 0.0);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normal;
  vUv = uv;
  vColor = aColor;
  vTiles = aTiles;
  float h = fract(sin(dot(aOffset, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vJitter = 0.945 + h * 0.09;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const FRAG = `
uniform float uOpacity;
uniform float uHighlight;
uniform float uCut;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform sampler2D uAtlas;
uniform float uHasTexture;

varying vec3 vColor;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorld;
varying float vJitter;
varying vec3 vTiles;

void main() {
  if (vWorld.z > uCut) discard;
  vec3 n = normalize(vNormal);
  float l1 = max(dot(n, normalize(vec3(0.35, 0.85, 0.45))), 0.0);
  float l2 = max(dot(n, normalize(vec3(-0.6, 0.25, -0.5))), 0.0);
  float side = 0.54 + 0.36 * l1 + 0.18 * l2;
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  side *= mix(0.76, 1.0, smoothstep(0.0, 0.055, edge));

  float tile = vNormal.y > 0.5 ? vTiles.y : (vNormal.y < -0.5 ? vTiles.z : vTiles.x);
  vec4 tex = vec4(1.0);
  bool textured = uHasTexture > 0.5 && tile >= 0.0;
  if (textured) {
    float cols = ${ATLAS_COLS}.0;
    float row = floor(tile / cols);
    vec2 origin = vec2(mod(tile, cols), cols - 1.0 - row);
    vec2 atlasUv = (origin + clamp(vUv, 0.001, 0.999)) / cols;
    tex = texture2D(uAtlas, atlasUv);
  }

  vec3 col = (textured ? tex.rgb : vColor) * side * vJitter;
  if (uHighlight > 0.5) {
    col = mix(col, vec3(0.85, 1.0, 0.38), 0.24) + 0.025;
  }
  float d = distance(vWorld, cameraPosition);
  float fog = smoothstep(uFogNear, uFogFar, d);
  col = mix(col, uFogColor, fog * 0.55);
  gl_FragColor = vec4(col, uOpacity * tex.a);
}
`

let whiteTexture: THREE.DataTexture | null = null
function getWhiteTexture(): THREE.DataTexture {
  if (!whiteTexture) {
    whiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat)
    whiteTexture.magFilter = THREE.NearestFilter
    whiteTexture.minFilter = THREE.NearestFilter
    whiteTexture.needsUpdate = true
  }
  return whiteTexture
}

function makeMaterial(opts: {
  opacity: number
  highlight: number
  ghost: boolean
  fogColor: THREE.Color
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: opts.opacity < 1,
    depthWrite: opts.opacity >= 1,
    depthTest: true,
    side: THREE.FrontSide,
    uniforms: {
      uOpacity: { value: opts.opacity },
      uHighlight: { value: opts.highlight },
      uCut: { value: 1e9 },
      uFogColor: { value: opts.fogColor },
      uFogNear: { value: 400 },
      uFogFar: { value: 1400 },
      uAtlas: { value: getWhiteTexture() },
      uHasTexture: { value: 0 },
    },
  })
}

function prettyBlock(name: string): string {
  const base = name.replace(/^minecraft:/, '').replace(/_/g, ' ')
  return base.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

interface Counts {
  baseO: number
  baseG: number
  curO: number
  curG: number
  above: number
}

export class VoxelViewer {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private group = new THREE.Group()
  private env = new THREE.Group()
  private boxGeo: THREE.BoxGeometry
  private meshes: THREE.Mesh[] = []
  private materials: THREE.ShaderMaterial[] = []
  private outline: THREE.LineSegments
  private tooltip: HTMLDivElement
  private tooltipCoords: HTMLDivElement
  private tooltipLabel: HTMLDivElement
  private model: ModelPayload | null = null
  private atlasTexture: THREE.Texture | null = null
  private texturesEnabled = false
  private view: ViewState = {
    layer: 0,
    buildMode: true,
    ghost: true,
    grid: true,
    autoRotate: false,
    cutaway: 0,
    backdrop: 'studio',
    active: true,
    editMode: false,
    origin: { x: 0, y: 64, z: 0 },
  }
  private raf = 0
  private lastTick = 0
  private resizeObserver: ResizeObserver
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private pointerDown = { x: 0, y: 0 }
  private dragging = false
  private hover: HoverInfo | null = null
  private lastPick: HoverInfo | null = null
  private tween:
    | {
        t: number
        duration: number
        fromPos: THREE.Vector3
        toPos: THREE.Vector3
        fromTarget: THREE.Vector3
        toTarget: THREE.Vector3
      }
    | null = null
  private disposed = false
  private options: ViewerOptions
  private colorCache = new Map<string, [number, number, number]>()
  private lastBuildKey = ''

  constructor(container: HTMLElement, options: ViewerOptions) {
    this.container = container
    this.options = options

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x0a0d0b, 1)
    this.renderer.domElement.className = 'webgl-canvas'
    container.appendChild(this.renderer.domElement)

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 12000)
    this.camera.position.set(80, 70, 100)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 3
    this.controls.maxDistance = 5000
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.autoRotateSpeed = 0.9
    ;(this.controls as unknown as { zoomToCursor: boolean }).zoomToCursor = true
    this.controls.addEventListener('start', () => {
      this.dragging = true
      this.hideTooltip()
    })
    this.controls.addEventListener('end', () => {
      this.dragging = false
    })

    this.boxGeo = new THREE.BoxGeometry(1, 1, 1)
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0xd9ff6b, transparent: true, opacity: 0.95 }),
    )
    this.outline.visible = false
    this.outline.renderOrder = 20
    ;(this.outline.material as THREE.LineBasicMaterial).depthTest = false
    ;(this.outline.material as THREE.LineBasicMaterial).depthWrite = false
    this.group.add(this.outline)
    this.scene.add(this.group)
    this.scene.add(this.env)

    this.tooltip = document.createElement('div')
    this.tooltip.className = 'hover-chip'
    this.tooltipCoords = document.createElement('div')
    this.tooltipCoords.className = 'hover-coords'
    this.tooltipLabel = document.createElement('div')
    this.tooltipLabel.className = 'hover-label'
    this.tooltip.append(this.tooltipCoords, this.tooltipLabel)
    this.tooltip.style.display = 'none'
    container.appendChild(this.tooltip)

    const canvas = this.renderer.domElement
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.applyBackdrop()
    this.tick()
  }

  private tick = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const now = performance.now()
    const dt = this.lastTick ? Math.min(0.08, (now - this.lastTick) / 1000) : 1 / 60
    this.lastTick = now
    if (this.tween) {
      this.tween.t += dt
      const k = Math.min(1, this.tween.t / this.tween.duration)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e)
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e)
      if (k >= 1) this.tween = null
    }
    this.controls.autoRotate = this.view.autoRotate && this.view.active && !this.dragging
    this.controls.update()
    if (!this.view.active) return
    this.renderer.render(this.scene, this.camera)
  }

  resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    if (this.view.active) this.renderer.render(this.scene, this.camera)
  }

  setModel(model: ModelPayload | null, frame = false): void {
    const first = !this.model && !!model
    const dimsChanged =
      !!model &&
      !!this.model &&
      (model.dims[0] !== this.model.dims[0] ||
        model.dims[1] !== this.model.dims[1] ||
        model.dims[2] !== this.model.dims[2])
    this.model = model
    this.lastBuildKey = ''
    if (!model) {
      this.clearMeshes()
      return
    }
    this.group.position.set(-model.dims[0] / 2, 0, -model.dims[2] / 2)
    if (frame || first) this.fit(false)
    else if (dimsChanged) this.refitFromCurrent()
    this.rebuildEnvironment()
    this.rebuildMeshes()
  }

  setView(partial: Partial<ViewState>): void {
    const prev = this.view
    this.view = { ...this.view, ...partial }
    if (
      prev.layer !== this.view.layer ||
      prev.buildMode !== this.view.buildMode ||
      prev.ghost !== this.view.ghost
    ) {
      this.lastBuildKey = ''
      this.rebuildMeshes()
    }
    if (prev.backdrop !== this.view.backdrop) this.applyBackdrop()
    if (prev.grid !== this.view.grid) this.env.visible = this.view.grid
    if (prev.autoRotate !== this.view.autoRotate) this.controls.autoRotate = this.view.autoRotate
    if (prev.cutaway !== this.view.cutaway) this.updateCutaway()
    if (prev.editMode !== this.view.editMode) {
      this.renderer.domElement.style.cursor = this.view.editMode ? 'crosshair' : 'grab'
    }
    if (!prev.active && this.view.active) this.resize()
  }

  setAtlasCanvas(canvas: HTMLCanvasElement | null, enabled: boolean): void {
    if (this.atlasTexture) {
      this.atlasTexture.dispose()
      this.atlasTexture = null
    }
    if (canvas) {
      const texture = new THREE.CanvasTexture(canvas)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.generateMipmaps = false
      texture.colorSpace = THREE.NoColorSpace
      texture.needsUpdate = true
      this.atlasTexture = texture
    }
    this.texturesEnabled = enabled && this.atlasTexture !== null
    for (const material of this.materials) {
      material.uniforms.uAtlas.value = this.atlasTexture ?? getWhiteTexture()
      material.uniforms.uHasTexture.value = this.texturesEnabled ? 1 : 0
    }
  }

  private applyBackdrop(): void {
    const theme = BACKDROPS[this.view.backdrop]
    this.scene.background = new THREE.Color(theme.bg)
    this.renderer.setClearColor(theme.bg, 1)
    const fog = new THREE.Color(theme.fog)
    for (const m of this.materials) {
      ;(m.uniforms.uFogColor.value as THREE.Color).copy(fog)
    }
    this.rebuildEnvironment()
  }

  private updateCutaway(): void {
    let cut = 1e9
    if (this.view.cutaway > 0 && this.model) {
      const halfZ = this.model.dims[2] / 2
      cut = halfZ - this.view.cutaway * this.model.dims[2]
      if (cut < -halfZ) cut = -halfZ
    }
    for (const m of this.materials) m.uniforms.uCut.value = cut
  }

  private clearMeshes(): void {
    for (const mesh of this.meshes) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
    }
    for (const m of this.materials) m.dispose()
    this.meshes = []
    this.materials = []
  }

  private rebuildEnvironment(): void {
    for (const child of [...this.env.children]) {
      this.env.remove(child)
      const obj = child as THREE.Mesh | THREE.LineSegments
      obj.geometry?.dispose()
      const mat = obj.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    }
    this.env.visible = this.view.grid
    if (!this.model) return
    const [nx, , nz] = this.model.dims
    const theme = BACKDROPS[this.view.backdrop]
    const maxDim = Math.max(nx, nz)
    const size = Math.max(12, Math.ceil(maxDim + 12))
    const spacing = maxDim <= 64 ? 1 : maxDim <= 128 ? 2 : maxDim <= 192 ? 4 : 8
    const divisions = Math.max(4, Math.ceil(size / spacing))
    const grid = new THREE.GridHelper(size, divisions, theme.grid, theme.minor)
    const gridMat = grid.material as THREE.LineBasicMaterial
    gridMat.transparent = true
    gridMat.opacity = 0.55
    gridMat.depthWrite = false
    grid.position.y = 0.015
    this.env.add(grid)

    // A soft contact shadow keeps large models grounded.
    const shadow = makeShadowTexture()
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.2, size * 1.2),
      new THREE.MeshBasicMaterial({
        map: shadow,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.y = 0.005
    this.env.add(plane)

    const axes = new THREE.Group()
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size / 2, 0.03, 0),
      new THREE.Vector3(size / 2, 0.03, 0),
    ])
    const xLine = new THREE.Line(
      xGeometry,
      new THREE.LineBasicMaterial({ color: 0x9a5544, transparent: true, opacity: 0.35 }),
    )
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.03, -size / 2),
      new THREE.Vector3(0, 0.03, size / 2),
    ])
    const zLine = new THREE.Line(
      zGeometry,
      new THREE.LineBasicMaterial({ color: 0x3f6b93, transparent: true, opacity: 0.35 }),
    )
    axes.add(xLine, zLine)
    this.env.add(axes)
  }

  private rebuildMeshes(): void {
    const model = this.model
    if (!model) return
    const key = `${this.view.layer}|${this.view.buildMode}|${this.view.ghost}`
    if (key === this.lastBuildKey) return
    this.lastBuildKey = key
    this.clearMeshes()

    const counts: Counts = { baseO: 0, baseG: 0, curO: 0, curG: 0, above: 0 }
    const classify = (packed: number): GroupId | null => {
      const y = (packed >>> 8) & 0xff
      const pal = (packed >>> 26) & 0x3f
      const transparent = !!model.palette[pal]?.transparent
      let group: 'base' | 'cur' | 'above' | null = null
      if (!this.view.buildMode) group = 'base'
      else if (y < this.view.layer) group = 'base'
      else if (y === this.view.layer) group = 'cur'
      else if (this.view.ghost) group = 'above'
      if (!group) return null
      if (group === 'above') return 'above'
      if (transparent) return group === 'cur' ? 'curG' : 'baseG'
      return group === 'cur' ? 'curO' : 'baseO'
    }
    for (let i = 0; i < model.blocks.length; i++) {
      const g = classify(model.blocks[i])
      if (g) counts[g] += 1
    }

    const buffers: Record<
      GroupId,
      { offsets: Float32Array; colors: Float32Array; kinds: Uint8Array; tiles: Float32Array } | null
    > = {
      baseO: null,
      baseG: null,
      curO: null,
      curG: null,
      above: null,
    }
    for (const id of GROUP_IDS) {
      if (counts[id] === 0) continue
      buffers[id] = {
        offsets: new Float32Array(counts[id] * 3),
        colors: new Float32Array(counts[id] * 3),
        kinds: new Uint8Array(counts[id]),
        tiles: new Float32Array(counts[id] * 3),
      }
    }
    const cursor: Counts = { baseO: 0, baseG: 0, curO: 0, curG: 0, above: 0 }

    for (let i = 0; i < model.blocks.length; i++) {
      const packed = model.blocks[i]
      const g = classify(packed)
      if (!g) continue
      const buf = buffers[g]
      if (!buf) continue
      const n = cursor[g]
      const x = packed & 0xff
      const y = (packed >>> 8) & 0xff
      const z = (packed >>> 16) & 0xff
      const kind = (packed >>> 24) & 0x3
      const pal = (packed >>> 26) & 0x3f
      const state = model.palette[pal]
      const color = this.colorFor(state?.name ?? 'minecraft:stone', state?.color)
      buf.offsets[n * 3] = x + 0.5
      buf.offsets[n * 3 + 1] = y + 0.5
      buf.offsets[n * 3 + 2] = z + 0.5
      buf.colors[n * 3] = color[0]
      buf.colors[n * 3 + 1] = color[1]
      buf.colors[n * 3 + 2] = color[2]
      buf.kinds[n] = kind
      const tiles = tileIndicesForState(state?.name ?? '')
      buf.tiles[n * 3] = tiles ? tiles.side : -1
      buf.tiles[n * 3 + 1] = tiles ? tiles.top : -1
      buf.tiles[n * 3 + 2] = tiles ? tiles.bottom : -1
      cursor[g] += 1
    }

    const theme = BACKDROPS[this.view.backdrop]
    const fog = new THREE.Color(theme.fog)
    const create = (
      id: GroupId,
      opts: { opacity: number; highlight: number; ghost: boolean; order: number },
    ): void => {
      const buf = buffers[id]
      if (!buf) return
      const material = makeMaterial({ ...opts, fogColor: fog })
      material.uniforms.uAtlas.value = this.atlasTexture ?? getWhiteTexture()
      material.uniforms.uHasTexture.value = this.texturesEnabled ? 1 : 0
      this.materials.push(material)
      const geometry = new THREE.InstancedBufferGeometry()
      geometry.index = this.boxGeo.index
      geometry.setAttribute('position', this.boxGeo.getAttribute('position'))
      geometry.setAttribute('normal', this.boxGeo.getAttribute('normal'))
      geometry.setAttribute('uv', this.boxGeo.getAttribute('uv'))
      geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(buf.offsets, 3))
      geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(buf.colors, 3))
      geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(buf.kinds, 1))
      geometry.setAttribute('aTiles', new THREE.InstancedBufferAttribute(buf.tiles, 3))
      geometry.instanceCount = counts[id]
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      mesh.renderOrder = opts.order
      this.group.add(mesh)
      this.meshes.push(mesh)
    }

    create('baseO', { opacity: 1, highlight: 0, ghost: false, order: 0 })
    create('curO', { opacity: 1, highlight: 1, ghost: false, order: 1 })
    create('baseG', { opacity: 0.48, highlight: 0, ghost: false, order: 2 })
    create('curG', { opacity: 0.6, highlight: 1, ghost: false, order: 3 })
    create('above', { opacity: 0.16, highlight: 0, ghost: true, order: 4 })

    const size = Math.max(...model.dims)
    for (const m of this.materials) {
      m.uniforms.uFogNear.value = size * 3.2 + 40
      m.uniforms.uFogFar.value = size * 11 + 240
    }
    this.updateCutaway()
  }

  private colorFor(name: string, color?: string): [number, number, number] {
    const key = `${name}|${color ?? ''}`
    const cached = this.colorCache.get(key)
    if (cached) return cached
    const c = new THREE.Color(color ?? '#8b8b85')
    const out: [number, number, number] = [c.r, c.g, c.b]
    this.colorCache.set(key, out)
    return out
  }

  private fitDistance(): number {
    if (!this.model) return 100
    const [nx, ny, nz] = this.model.dims
    const size = Math.max(nx, ny, nz)
    const fov = THREE.MathUtils.degToRad(this.camera.fov)
    const aspect = Math.max(0.3, this.camera.aspect)
    const hFov = 2 * Math.atan(Math.tan(fov / 2) * aspect)
    const base = size * 1.8 + 16
    const widthFit = (size * 0.62) / Math.tan(hFov / 2)
    const heightFit = (size * 0.62) / Math.tan(fov / 2)
    return Math.max(base, widthFit, heightFit)
  }

  private fit(animate: boolean): void {
    if (!this.model) return
    const [, ny] = this.model.dims
    const target = new THREE.Vector3(0, ny * 0.46, 0)
    const dir = new THREE.Vector3(1, 0.82, 1.12).normalize()
    const pos = target.clone().addScaledVector(dir, this.fitDistance())
    this.moveCamera(pos, target, animate)
  }

  private refitFromCurrent(): void {
    if (!this.model) return
    const [, ny] = this.model.dims
    const dir = this.camera.position.clone().sub(this.controls.target)
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.82, 1.12)
    const target = new THREE.Vector3(0, ny * 0.46, 0)
    const pos = target.clone().addScaledVector(dir.normalize(), this.fitDistance())
    this.moveCamera(pos, target, false)
  }

  setCamera(preset: 'iso' | 'front' | 'side' | 'top' | 'fit'): void {
    if (!this.model) return
    const [, ny] = this.model.dims
    const target = new THREE.Vector3(0, ny * 0.46, 0)
    const dist = this.fitDistance()
    const dirs = {
      iso: new THREE.Vector3(1, 0.82, 1.12),
      front: new THREE.Vector3(0, 0.18, 1),
      side: new THREE.Vector3(1, 0.18, 0),
      top: new THREE.Vector3(0, 1, 0.0001),
      fit: new THREE.Vector3(1, 0.82, 1.12),
    }
    const pos = target.clone().addScaledVector(dirs[preset].normalize(), dist)
    this.moveCamera(pos, target, true)
  }

  private moveCamera(pos: THREE.Vector3, target: THREE.Vector3, animate: boolean): void {
    if (!animate) {
      this.tween = null
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
      return
    }
    this.tween = {
      t: 0,
      duration: 0.55,
      fromPos: this.camera.position.clone(),
      toPos: pos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
    }
  }

  screenshot(): void {
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'shapeshift-view.png'
    a.click()
  }

  private updateTooltipPosition(clientX: number, clientY: number): void {
    const rect = this.container.getBoundingClientRect()
    const x = Math.min(rect.width - 200, Math.max(8, clientX - rect.left + 16))
    const y = Math.min(rect.height - 90, Math.max(8, clientY - rect.top + 18))
    this.tooltip.style.transform = `translate(${x}px, ${y}px)`
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none'
    this.outline.visible = false
    this.hover = null
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.dragging || !this.view.active) return
    const hit = this.pick(event)
    if (!hit) {
      this.hideTooltip()
      return
    }
    this.hover = hit
    this.lastPick = hit
    const model = this.model!
    const [nx] = model.dims
    const localX = hit.x - Math.floor(nx / 2)
    const localZ = hit.z - Math.floor(model.dims[2] / 2)
    const wx = localX + this.view.origin.x
    const wy = hit.y + this.view.origin.y
    const wz = localZ + this.view.origin.z
    this.tooltipCoords.textContent = `x ${wx}   y ${wy}   z ${wz}`
    const state = model.palette[hit.palette]
    const kindLabel =
      state?.kind === 'bottom' ? ' · bottom slab' : state?.kind === 'top' ? ' · top slab' : ''
    this.tooltipLabel.textContent = `${prettyBlock(state?.name ?? 'block')}${kindLabel}`
    this.tooltip.style.display = 'block'
    this.updateTooltipPosition(event.clientX, event.clientY)

    const kind = (hit as HoverInfo).kind
    this.outline.visible = true
    this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
    if (kind === 1) {
      this.outline.position.y = hit.y + 0.25
      this.outline.scale.set(1, 0.52, 1)
    } else if (kind === 2) {
      this.outline.position.y = hit.y + 0.75
      this.outline.scale.set(1, 0.52, 1)
    } else {
      this.outline.scale.set(1, 1, 1)
    }
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private onPointerUp = (event: PointerEvent): void => {
    const moved = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y)
    const hit = this.hover ?? this.lastPick
    if (moved > 5 || !hit) return
    if (this.view.editMode) {
      this.options.onEdit?.(hit)
      return
    }
    const model = this.model
    if (!model) return
    const nx = model.dims[0]
    const nz = model.dims[2]
    const wx = hit.x - Math.floor(nx / 2) + this.view.origin.x
    const wy = hit.y + this.view.origin.y
    const wz = hit.z - Math.floor(nz / 2) + this.view.origin.z
    const text = `${wx} ${wy} ${wz}`
    navigator.clipboard
      ?.writeText(text)
      .then(() => this.options.onToast(`Copied ${text}`))
      .catch(() => this.options.onToast(text))
  }

  private onPointerLeave = (): void => {
    this.lastPick = null
    this.hideTooltip()
  }

  private pick(event: PointerEvent): HoverInfo | null {
    const model = this.model
    if (!model) return null
    const rect = this.container.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const ray = this.raycaster.ray
    const [nx, ny, nz] = model.dims
    const origin = ray.origin.clone().sub(this.group.position)
    const dir = ray.direction

    let tmin = 0
    let tmax = 1e9
    const axes: [number, number, number, number][] = [
      [origin.x, dir.x, 0, nx],
      [origin.y, dir.y, 0, ny],
      [origin.z, dir.z, 0, nz],
    ]
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) return null
      } else {
        let t1 = (lo - o) / d
        let t2 = (hi - o) / d
        if (t1 > t2) [t1, t2] = [t2, t1]
        tmin = Math.max(tmin, t1)
        tmax = Math.min(tmax, t2)
        if (tmin > tmax) return null
      }
    }

    let t = tmin + 0.0001
    const p = origin.clone().addScaledVector(dir, t)
    let x = Math.max(0, Math.min(nx - 1, Math.floor(p.x)))
    let y = Math.max(0, Math.min(ny - 1, Math.floor(p.y)))
    let z = Math.max(0, Math.min(nz - 1, Math.floor(p.z)))
    let lastAxis: 'x' | 'y' | 'z' = 'y'
    let lastSign = 1
    let stepped = false
    const entry = p.clone()
    const stepX = dir.x > 0 ? 1 : -1
    const stepY = dir.y > 0 ? 1 : -1
    const stepZ = dir.z > 0 ? 1 : -1
    const tDeltaX = Math.abs(1 / (dir.x || 1e-9))
    const tDeltaY = Math.abs(1 / (dir.y || 1e-9))
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-9))
    let tMaxX =
      dir.x > 0 ? (x + 1 - origin.x) / dir.x : (origin.x - x) / -dir.x
    let tMaxY =
      dir.y > 0 ? (y + 1 - origin.y) / dir.y : (origin.y - y) / -dir.y
    let tMaxZ =
      dir.z > 0 ? (z + 1 - origin.z) / dir.z : (origin.z - z) / -dir.z

    for (let guard = 0; guard < nx + ny + nz + 8; guard++) {
      if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return null
      const palette = model.data[(y * nz + z) * nx + x]
      // In build mode, layers above the active layer are shown as ghosts (or
      // hidden entirely). They must not intercept hover/click picking; skip
      // them and keep marching until we reach a solid selected layer.
      const pickable = !this.view.buildMode || y <= this.view.layer
      if (palette !== 0 && pickable) {
        const state = model.palette[palette]
        const kind = state.kind === 'bottom' ? 1 : state.kind === 'top' ? 2 : 0
        const tExit = Math.min(tMaxX, tMaxY, tMaxZ)
        const yA = origin.y + dir.y * t
        const yB = origin.y + dir.y * Math.min(tExit, tmax)
        const yLo = Math.min(yA, yB)
        const yHi = Math.max(yA, yB)
        const slabLo = kind === 2 ? y + 0.5 : y
        const slabHi = kind === 1 ? y + 0.5 : y + 1
        if (kind === 0 || (yHi >= slabLo && yLo <= slabHi)) {
          const normal = { x: 0, y: 0, z: 0 }
          if (stepped) {
            normal[lastAxis] = -lastSign
          } else {
            // The camera can start inside the model; use the nearest bbox face.
            let best = Infinity
            const axes: Array<['x' | 'y' | 'z', number, number]> = [
              ['x', entry.x, dir.x],
              ['y', entry.y, dir.y],
              ['z', entry.z, dir.z],
            ]
            for (const [axis, value, direction] of axes) {
              const dist = Math.abs(value - Math.round(value))
              if (dist < best) {
                best = dist
                normal.x = 0
                normal.y = 0
                normal.z = 0
                normal[axis] = -(Math.sign(direction) || 1)
              }
            }
          }
          return {
            x,
            y,
            z,
            kind,
            palette,
            label: state.name,
            normal,
          }
        }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX
        t = tMaxX
        tMaxX += tDeltaX
        lastAxis = 'x'
        lastSign = stepX
      } else if (tMaxY < tMaxZ) {
        y += stepY
        t = tMaxY
        tMaxY += tDeltaY
        lastAxis = 'y'
        lastSign = stepY
      } else {
        z += stepZ
        t = tMaxZ
        tMaxZ += tDeltaZ
        lastAxis = 'z'
        lastSign = stepZ
      }
      stepped = true
      if (t > tmax) return null
    }
    return null
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.clearMeshes()
    this.rebuildEnvironment()
    this.outline.geometry.dispose()
    ;(this.outline.material as THREE.Material).dispose()
    if (this.atlasTexture) this.atlasTexture.dispose()
    this.atlasTexture = null
    this.boxGeo.dispose()
    this.controls.dispose()
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.tooltip.remove()
  }
}

let shadowTexture: THREE.Texture | null = null
function makeShadowTexture(): THREE.Texture {
  if (shadowTexture) return shadowTexture
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  shadowTexture = tex
  return tex
}
