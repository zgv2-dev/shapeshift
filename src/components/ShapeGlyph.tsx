import type { JSX } from 'react'

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const ga = { ...common, className: 'ga' }

const ICONS: Record<string, JSX.Element> = {
  sphere: (
    <>
      <circle cx="20" cy="20" r="11.5" {...common} />
      <ellipse cx="20" cy="20" rx="11.5" ry="4.5" {...ga} />
      <path d="M20 8.5v23" opacity=".18" {...common} />
    </>
  ),
  ellipsoid: (
    <>
      <ellipse cx="20" cy="20" rx="13.5" ry="8.5" transform="rotate(-24 20 20)" {...common} />
      <path d="M10 12c7 3 14 3 20 0" {...ga} />
    </>
  ),
  dome: (
    <>
      <path d="M7 27a13 13 0 0 1 26 0" {...common} />
      <path d="M4 27h32" {...ga} />
      <path d="M20 14v13" opacity=".2" {...common} />
    </>
  ),
  torus: (
    <>
      <ellipse cx="20" cy="20" rx="13.5" ry="8" {...common} />
      <ellipse cx="20" cy="20" rx="5.5" ry="3.2" {...ga} />
    </>
  ),
  ellipse: (
    <>
      <ellipse cx="20" cy="21" rx="14" ry="6" {...common} />
      <ellipse cx="20" cy="21" rx="9" ry="3.6" {...ga} />
    </>
  ),
  cylinder: (
    <>
      <path d="M11 12v16c0 2 4 3.5 9 3.5s9-1.5 9-3.5V12" {...common} />
      <ellipse cx="20" cy="12" rx="9" ry="3.5" {...ga} />
    </>
  ),
  cone: (
    <>
      <path d="M20 6 30 28M20 6 10 28" {...common} />
      <ellipse cx="20" cy="28" rx="10" ry="3.2" {...ga} />
    </>
  ),
  frustum: (
    <>
      <path d="M13 10 9 28M27 10l4 18" {...common} />
      <ellipse cx="20" cy="10" rx="7" ry="2.4" {...common} />
      <ellipse cx="20" cy="28" rx="11" ry="3.4" {...ga} />
    </>
  ),
  pyramid: (
    <>
      <path d="M20 6 34 31H6Z" {...common} />
      <path d="M20 6v25M6 31l14-9 14 9" opacity=".35" {...common} />
    </>
  ),
  capsule: (
    <>
      <rect x="13" y="5" width="14" height="30" rx="7" {...common} />
      <path d="M13 22h14" {...ga} />
    </>
  ),
  paraboloid: (
    <>
      <path d="M7 10c0 13 5 20 13 20s13-7 13-20" {...common} />
      <path d="M6 10h28" {...ga} />
    </>
  ),
  hyperboloid: (
    <>
      <path d="M9 8c6 8 6 16 0 24M31 8c-6 8-6 16 0 24" {...common} />
      <ellipse cx="20" cy="8" rx="11" ry="3" {...common} />
      <ellipse cx="20" cy="32" rx="11" ry="3" {...ga} />
    </>
  ),
  egg: (
    <>
      <path d="M20 5c7 0 11 10 11 17 0 7-5 12-11 12S9 29 9 22C9 15 13 5 20 5Z" {...common} />
      <path d="M13 23c3 2 11 2 14 0" opacity=".3" {...common} />
    </>
  ),
  heart: (
    <path d="M20 34S5 25 5 15a7.5 7.5 0 0 1 15-4 7.5 7.5 0 0 1 15 4c0 10-15 19-15 19Z" {...ga} />
  ),
  superellipsoid: (
    <>
      <rect x="7" y="9" width="26" height="23" rx="8" {...common} />
      <path d="M7 18h26M20 9v23" opacity=".25" {...common} />
      <path d="M12 9c-2 7 0 16 8 23" opacity=".4" {...ga} />
    </>
  ),
  ring: (
    <>
      <ellipse cx="20" cy="20" rx="14" ry="9" {...common} />
      <ellipse cx="20" cy="20" rx="7" ry="4.2" {...ga} />
    </>
  ),
  prism: (
    <>
      <path d="M20 5 32 12v15L20 35 8 27V12Z" {...common} />
      <path d="M20 5v30M8 12l12 8 12-8" opacity=".3" {...common} />
    </>
  ),
  box: (
    <>
      <path d="M20 4 35 13v14L20 36 5 27V13Z" {...common} />
      <path d="M5 13l15 9 15-9M20 22v14" {...ga} />
    </>
  ),
  diamond: (
    <>
      <path d="M20 4 35 20 20 36 5 20Z" {...common} />
      <path d="M5 20h30M20 4v32" opacity=".3" {...common} />
    </>
  ),
  star: (
    <path
      d="M20 4l4.5 11.2L36 16l-8.5 8 2.5 11.5L20 29.6 10 35.5 12.5 24 4 16l11.5-.8Z"
      {...ga}
    />
  ),
  cross: <path d="M15 5h10v10h10v10H25v10H15V25H5V15h10Z" {...ga} />,
  crescent: (
    <path d="M25 5a14 14 0 1 0 0 30 16.5 16.5 0 0 1 0-30Z" {...ga} />
  ),
  gear: (
    <>
      <circle cx="20" cy="20" r="11" {...common} />
      <circle cx="20" cy="20" r="4.3" {...ga} />
      <path
        d="M20 4v6M20 30v6M4 20h6M30 20h6M8.7 8.7l4.2 4.2M27.1 27.1l4.2 4.2M31.3 8.7l-4.2 4.2M12.9 27.1l-4.2 4.2"
        {...common}
      />
    </>
  ),
  arch: (
    <>
      <path d="M7 33V21a13 13 0 0 1 26 0v12" {...common} />
      <path d="M15 33V21a5 5 0 0 1 10 0v12" {...ga} />
    </>
  ),
  helix: (
    <>
      <path d="M14 5c13 4 13 10 0 14s-13 10 0 14" {...common} />
      <path d="M14 5h12M14 33h12" opacity=".4" {...common} />
      <path d="M20 12h8M20 26h8" opacity=".4" {...ga} />
    </>
  ),
  'double-helix': (
    <>
      <path d="M13 5c10 6 10 12 0 18s-10 12 0 12" {...common} />
      <path d="M27 5c-10 6-10 12 0 18s10 12 0 12" {...ga} />
      <path d="M14 12h12M14 22h12M14 30h12" opacity=".35" {...common} />
    </>
  ),
  'spiral-stair': (
    <>
      <path d="M8 33h18M8 27h14M8 21h18M8 15h13M8 9h17" {...common} />
      <path d="M26 33V9" {...ga} />
      <path d="M32 33V9" opacity=".25" {...common} />
    </>
  ),
  mobius: (
    <>
      <path d="M8 16c4-8 12-6 12 0s8 10 12 2-4-14-12-8S4 24 12 30s16 0 16-8" {...common} />
      <path d="M12 13c6 5 10 13 8 16" opacity=".4" {...ga} />
    </>
  ),
  'torus-knot': (
    <>
      <path d="M20 34c-9-3-13-10-9-16 3-5 10-4 13 0 4 6 0 13-6 12-7-1-8-9-2-13 7-5 16 1 14 9-1 6-8 9-12 6" {...common} />
      <circle cx="20" cy="20" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  'wave-wall': (
    <>
      <path d="M4 29c6-18 11-18 16 0s10 18 16 0" {...common} />
      <path d="M4 32h32" {...ga} />
    </>
  ),
  observatory: (
    <>
      <path d="M10 33V18h20v15" {...common} />
      <path d="M9 18a11 11 0 0 1 22 0" {...common} />
      <path d="M17 33v-8h6v8" {...ga} />
      <path d="M28 12 36 7" opacity=".5" {...common} />
    </>
  ),
  'wizard-tower': (
    <>
      <path d="M12 33V15h14v18" {...common} />
      <path d="M9 15 19 3l10 12" {...ga} />
      <path d="M17 33v-8h5v8" opacity=".4" {...common} />
      <path d="M25 25h8v8" opacity=".4" {...common} />
    </>
  ),
  'dope-tower': (
    <>
      <path d="M15 34V17h10v17M15 34h10" {...common} />
      <path d="M13 17l2.5-3 1 1.5 2.5-6.5 2.5 6.5 1-1.5 2.5 3-2 2h-8Z" {...ga} />
      <path d="M20 6v3" {...common} />
    </>
  ),
  lighthouse: (
    <>
      <path d="M14 33 16 10h8l2 23" {...common} />
      <path d="M13 10h14" {...ga} />
      <path d="M16 10c0-4 8-4 8 0" {...common} />
      <path d="M31 7l4-3M31 13l5 1M27 4l2-2" opacity=".5" {...common} />
    </>
  ),
  snowman: (
    <>
      <circle cx="20" cy="27" r="8" {...common} />
      <circle cx="20" cy="16" r="5.5" {...common} />
      <circle cx="20" cy="8" r="4" {...ga} />
      <path d="M16 16h.1M24 16h.1" {...common} strokeWidth={2.5} />
    </>
  ),
  igloo: (
    <>
      <path d="M5 26a15 15 0 0 1 30 0" {...common} />
      <path d="M5 26h30" {...common} />
      <path d="M13 26v-6a7 7 0 0 1 14 0v6" {...ga} />
    </>
  ),
  geodesic: (
    <>
      <path d="M5 29a15 15 0 0 1 30 0Z" {...common} />
      <path d="M5 29 20 14l15 15M20 14v15M11 21h18M8 25h24" opacity=".55" {...ga} />
    </>
  ),
}

export function ShapeGlyph({ id, size = 36 }: { id: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className="shape-glyph"
    >
      {ICONS[id] ?? ICONS.sphere}
    </svg>
  )
}
