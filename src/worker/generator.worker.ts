/// <reference lib="webworker" />
import { getShape } from '../core/shapes'
import { buildRenderData } from '../core/renderData'
import type { GenerationContext, MaterialSet, ModelPayload, ParamValue } from '../core/types'

interface GenerateRequest {
  id: number
  shapeId: string
  params: Record<string, ParamValue>
  materials: MaterialSet
  detail: boolean
}

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { id, shapeId, params, materials, detail } = event.data
  const started = performance.now()
  try {
    const shape = getShape(shapeId)
    const generation: GenerationContext = {
      p: params,
      detail,
      materials,
      roleBlockNames: [materials.primary, materials.accent, materials.detail],
    }
    const model = shape.generate(generation).finish()
    const render = buildRenderData(model)
    const payload: ModelPayload = {
      ...model,
      shapeId,
      blocks: render.blocks,
      world: { genMs: Math.round(performance.now() - started) },
    }
    const transfer: Transferable[] = [payload.data.buffer, payload.blocks.buffer]
    ctx.postMessage({ id, ok: true, model: payload }, transfer)
  } catch (error) {
    ctx.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export {}
