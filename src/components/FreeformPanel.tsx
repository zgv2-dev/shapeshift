import { Eraser, Hammer, LogOut, Pencil, Plus, Redo2, Undo2 } from 'lucide-react'
import { BLOCKS, getBlock } from '../core/blocks'
import { getShape } from '../core/shapes'
import { useStore } from '../state/store'
import { translateText } from '../i18n/translate'
import { IsoBlock } from './IsoBlock'

export function FreeformPanel() {
  const active = useStore((s) => s.freeformActive)
  const model = useStore((s) => s.model)
  const tool = useStore((s) => s.freeformTool)
  const block = useStore((s) => s.freeformBlock)
  const history = useStore((s) => s.freeformHistory)
  const future = useStore((s) => s.freeformFuture)
  const shapeId = useStore((s) => s.shapeId)
  const language = useStore((s) => s.language)
  const start = useStore((s) => s.startFreeform)
  const exit = useStore((s) => s.exitFreeform)
  const setTool = useStore((s) => s.setFreeformTool)
  const setBlock = useStore((s) => s.setFreeformBlock)
  const addShape = useStore((s) => s.addShapeToFreeform)
  const undo = useStore((s) => s.undoFreeform)
  const redo = useStore((s) => s.redoFreeform)
  const shape = getShape(shapeId)
  const activeBlock = getBlock(block)

  if (!active) {
    return (
      <div className="freeform-panel">
        <p className="eyebrow">Freeform</p>
        <h3>Freeform editor</h3>
        <p className="freeform-lede">
          Copy the current shape into an editable voxel model. Combine copies of shapes, then place
          or remove individual blocks directly in the 3D view.
        </p>
        <button className="btn primary freeform-start" onClick={start} disabled={!model || model.counts.total === 0}>
          <Pencil size={14} />
          Start freeform
        </button>
        <p className="fine-print">
          Starts from the current model. Nothing leaves your browser; the result exports through the
          normal Litematica, Sponge and structure-block formats.
        </p>
      </div>
    )
  }

  return (
    <div className="freeform-panel">
      <div className="freeform-head">
        <div>
          <p className="eyebrow">Freeform</p>
          <h3>Editing blocks</h3>
        </div>
        <button className="btn tiny ghost" onClick={exit}>
          <LogOut size={12} /> Exit
        </button>
      </div>

      <div className="freeform-tools" role="group" aria-label="Freeform tool">
        <button
          className={`freeform-tool ${tool === 'place' ? 'active' : ''}`}
          onClick={() => setTool('place')}
          aria-pressed={tool === 'place'}
        >
          <Plus size={14} /> Place
        </button>
        <button
          className={`freeform-tool ${tool === 'remove' ? 'active' : ''}`}
          onClick={() => setTool('remove')}
          aria-pressed={tool === 'remove'}
        >
          <Eraser size={14} /> Remove
        </button>
      </div>

      <div className="freeform-block-row">
        <IsoBlock block={block} size={30} />
        <label>
          <span>Place block</span>
          <select
            className="freeform-select"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            aria-label="Freeform place block"
          >
            {BLOCKS.map((b) => (
              <option key={b.id} value={b.id}>
                {translateText(language, b.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="btn ghost freeform-add"
        onClick={addShape}
        title={`Add ${shape.name} above`}
      >
        <Hammer size={14} />
        Add shape above
      </button>

      <div className="freeform-actions">
        <button className="btn tiny ghost" onClick={undo} disabled={history.length === 0}>
          <Undo2 size={12} /> Undo
        </button>
        <button className="btn tiny ghost" onClick={redo} disabled={future.length === 0}>
          <Redo2 size={12} /> Redo
        </button>
      </div>

      <p className="freeform-hint">
        {tool === 'place'
          ? 'Place adds a block against the face you click.'
          : 'Remove deletes the block you click.'}
      </p>
      <p className="freeform-hint freeform-hint-secondary">
        Switch to the Shape tab to pick another shape before adding it.
      </p>
      <p className="fine-print">
        <span>Current place material:</span>{' '}
        <IsoBlock block={activeBlock.id} size={18} /> {activeBlock.label}
      </p>
    </div>
  )
}
