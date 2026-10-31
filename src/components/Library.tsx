import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { CATEGORIES, SHAPES } from '../core/shapes'
import { useStore } from '../state/store'
import { ShapeGlyph } from './ShapeGlyph'

export function Library() {
  const shapeId = useStore((s) => s.shapeId)
  const setShape = useStore((s) => s.setShape)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const category = useStore((s) => s.category)
  const setCategory = useStore((s) => s.setCategory)
  const open = useStore((s) => s.libraryOpen)
  const setOpen = useStore((s) => s.setLibraryOpen)

  const filtered = useMemo(() => {
    const norm = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    const q = norm(search.trim())
    return SHAPES.filter((shape) => {
      if (category !== 'all' && shape.category !== category) return false
      if (!q) return true
      return (
        norm(shape.name).includes(q) ||
        norm(shape.tagline).includes(q) ||
        norm(shape.category).includes(q)
      )
    })
  }, [search, category])

  const groups = CATEGORIES.map((cat) => ({
    ...cat,
    shapes: filtered.filter((s) => s.category === cat.id),
  })).filter((g) => g.shapes.length > 0)

  return (
    <aside className={`library ${open ? 'open' : ''}`} aria-label="Shape library">
      <div className="library-head">
        <div>
          <p className="eyebrow">Shape library</p>
          <h2>Choose a form</h2>
        </div>
        <div className="library-count">{SHAPES.length}</div>
        <button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Close library">
          <X size={17} />
        </button>
      </div>

      <label className="search-box">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shapes"
          aria-label="Search shapes"
        />
        {search ? (
          <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
            <X size={13} />
          </button>
        ) : null}
      </label>

      <div className="category-chips" role="tablist" aria-label="Shape categories">
        <button
          className={category === 'all' ? 'chip active' : 'chip'}
          onClick={() => setCategory('all')}
        >
          All
          <span>{SHAPES.length}</span>
        </button>
        {CATEGORIES.map((cat) => {
          const count = SHAPES.filter((s) => s.category === cat.id).length
          return (
            <button
              key={cat.id}
              className={category === cat.id ? 'chip active' : 'chip'}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
              <span>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="shape-list">
        {groups.map((group) => (
          <section key={group.id} className="shape-group">
            <div className="shape-group-head">
              <span>{group.label}</span>
              <span>{group.blurb}</span>
            </div>
            {group.shapes.map((shape) => (
              <button
                key={shape.id}
                className={`shape-item ${shape.id === shapeId ? 'active' : ''}`}
                onClick={() => {
                  setShape(shape.id)
                  setOpen(false)
                }}
                title={`${shape.tagline}\n\n${shape.description}`}
              >
                <span className="shape-glyph-wrap">
                  <ShapeGlyph id={shape.id} size={34} />
                </span>
                <span className="shape-item-copy">
                  <strong>{shape.name}</strong>
                  <small>{shape.tagline}</small>
                </span>
                <span className="shape-item-dot" />
              </button>
            ))}
          </section>
        ))}
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No shapes match “{search}”.</p>
            <button className="btn ghost" onClick={() => { setSearch(''); setCategory('all') }}>
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <footer className="library-foot">
        <p>
          <kbd>1</kbd> 3D <kbd>2</kbd> blueprint <kbd>←</kbd>
          <kbd>→</kbd> layers
        </p>
        <p className="muted">{SHAPES.length} parametric shapes · half-slab detail · schematic export</p>
      </footer>
    </aside>
  )
}
