import { useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, Search } from 'lucide-react'
import { BLOCK_GROUPS, BLOCKS, getBlock, slabFor } from '../core/blocks'
import { getShape } from '../core/shapes'
import { TEXTURE_VERSION } from '../core/versions'
import { useStore } from '../state/store'
import { translateText } from '../i18n/translate'
import { loadBlockAtlas } from '../three/textures'
import { IsoBlock } from './IsoBlock'
import type { RoleKey } from '../core/types'

export function MaterialPicker() {
  const shapeId = useStore((s) => s.shapeId)
  const materials = useStore((s) => s.materials)
  const setMaterial = useStore((s) => s.setMaterial)
  const resetMaterials = useStore((s) => s.resetMaterials)
  const shape = getShape(shapeId)
  const language = useStore((s) => s.language)
  const atlas = useStore((s) => s.atlas)
  const setAtlas = useStore((s) => s.setAtlas)
  const [role, setRole] = useState<RoleKey>('primary')
  const [search, setSearch] = useState('')
  const activeRole = shape.roles.some((r) => r.key === role) ? role : shape.roles[0].key

  // The block browser should show real textures even when the 3D texture toggle
  // is off. The atlas is shared with the viewer and cached after the first load.
  useEffect(() => {
    if (atlas) return
    let cancelled = false
    loadBlockAtlas()
      .then((loaded) => {
        if (!cancelled) setAtlas(loaded)
      })
      .catch(() => {
        /* flat-colour cubes are the offline fallback */
      })
    return () => {
      cancelled = true
    }
  }, [atlas, setAtlas])
  const activeBlock = getBlock(materials[activeRole])
  const activeSlab = slabFor(materials[activeRole])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return BLOCKS.filter(
      (b) =>
        !q ||
        b.label.toLowerCase().includes(q) ||
        translateText(language, b.label).toLowerCase().includes(q),
    )
  }, [search, language])

  return (
    <div className="material-picker">
      <div className="material-head">
        <div>
          <p className="eyebrow">Block palette</p>
          <h3>Materials</h3>
        </div>
        <button className="btn tiny ghost" onClick={resetMaterials} title="Reset to shape defaults">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="role-cards">
        {shape.roles.map((r) => {
          const block = getBlock(materials[r.key])
          return (
            <button
              key={r.key}
              className={`role-card ${activeRole === r.key ? 'active' : ''}`}
              onClick={() => setRole(r.key)}
            >
              <IsoBlock block={block.id} size={28} />
              <span>
                <small>{r.label}</small>
                <strong>{block.label}</strong>
              </span>
            </button>
          )
        })}
      </div>

      <div className="active-block-note">
        <IsoBlock block={activeBlock.id} size={26} />
        <div>
          <strong>{activeBlock.label}</strong>
          <small>
            {activeSlab
              ? `Half slabs use ${activeSlab.replace('minecraft:', '').replace(/_/g, ' ')}`
              : 'No slab variant — half-slab cells stay full blocks'}
          </small>
        </div>
      </div>

      <label className="search-box compact">
        <Search size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a block"
          aria-label="Find a block"
        />
      </label>

      <div className="block-groups">
        {BLOCK_GROUPS.map((group) => {
          const blocks = filtered.filter((b) => b.group === group)
          if (blocks.length === 0) return null
          return (
            <div key={group} className="block-group">
              <div className="block-group-head">{group}</div>
              <div className="block-grid">
                {blocks.map((b) => (
                  <button
                    key={b.id}
                    className={`block-swatch ${materials[activeRole] === b.id ? 'active' : ''}`}
                    onClick={() => setMaterial(activeRole, b.id)}
                    title={`${b.label}${b.slab ? ' · has slab' : ''}`}
                    aria-label={b.label}
                  >
                    <IsoBlock block={b.id} size={30} />
                    {materials[activeRole] === b.id ? <Check size={11} /> : null}
                    {b.slab ? <i className="slab-flag">½</i> : null}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="fine-print">
        Half-slab cells pick the matching slab block automatically. Glass and other slab-less
        materials stay as full blocks so the export remains valid.
      </p>
      <p className="fine-print texture-note">
        Block previews use real Minecraft {TEXTURE_VERSION} textures when the atlas is available.
        Textures are fetched at runtime from a public asset mirror and are not bundled.
      </p>
    </div>
  )
}
