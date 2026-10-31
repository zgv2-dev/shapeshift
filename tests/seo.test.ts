import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const exists = (path: string) => statSync(resolve(process.cwd(), path)).isFile()

describe('SEO surface', () => {
  const landing = read('index.html')

  it('has a distinct, searchable title and description', () => {
    const title = landing.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
    const description = landing.match(/<meta\s+name="description"\s+content="([^"]+)"/s)?.[1] ?? ''
    expect(title).toBe("ShapeShiftMC — Minecraft Shape Generator That Isn't Boxy")
    expect(title.length).toBeLessThanOrEqual(60)
    expect(description.length).toBeGreaterThan(120)
    expect(description.length).toBeLessThanOrEqual(170)
  })

  it('uses one H1 and the right canonical/OG/Twitter tags', () => {
    expect((landing.match(/<h1[\s>]/g) ?? []).length).toBe(1)
    expect(landing).toContain('<link rel="canonical" href="https://shapeshift.mc.zgv2.dev/" />')
    expect(landing).toContain('<meta property="og:url" content="https://shapeshift.mc.zgv2.dev/" />')
    expect(landing).toContain('<meta property="og:image" content="https://shapeshift.mc.zgv2.dev/og.png" />')
    expect(landing).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(landing).toContain('<meta name="twitter:image" content="https://shapeshift.mc.zgv2.dev/og.png" />')
  })

  it('ships valid SoftwareApplication and FAQ structured data', () => {
    const raw = landing.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
    expect(raw).toBeTruthy()
    const data = JSON.parse(raw!) as { '@graph': Array<{ '@type': string }> }
    const types = data['@graph'].map((node) => node['@type'])
    expect(types).toContain('WebSite')
    expect(types).toContain('SoftwareApplication')
    expect(types).toContain('FAQPage')
  })

  it('links the crawlable shape pages into the studio', () => {
    expect(landing).toContain('href="/studio/?shape=sphere"')
    expect(landing).toContain('href="/studio/?shape=torus"')
    expect(landing).toContain('href="/studio/?shape=dope-tower"')
  })

  it('keeps the studio page canonical and similarly distinctive', () => {
    const studio = read('studio/index.html')
    expect(studio).toContain('<title>Shape Studio — Minecraft Slabs &amp; Blueprints | ShapeShiftMC</title>')
    expect(studio).toContain('<link rel="canonical" href="https://shapeshift.mc.zgv2.dev/studio/" />')
    expect(studio).toContain('name="description"')
  })

  it('ships robots, sitemap, manifest and social assets', () => {
    const robots = read('public/robots.txt')
    const sitemap = read('public/sitemap.xml')
    const manifest = JSON.parse(read('public/site.webmanifest')) as { start_url: string }
    expect(robots).toContain('Sitemap: https://shapeshift.mc.zgv2.dev/sitemap.xml')
    expect(sitemap).toContain('<loc>https://shapeshift.mc.zgv2.dev/</loc>')
    expect(sitemap).toContain('<loc>https://shapeshift.mc.zgv2.dev/studio/</loc>')
    expect(manifest.start_url).toBe('/studio/')
    expect(exists('public/og.png')).toBe(true)
    expect(exists('public/preview.webp')).toBe(true)
    expect(exists('public/screens/blueprint.webp')).toBe(true)
    expect(exists('public/screens/tower.webp')).toBe(true)
    expect(statSync(resolve(process.cwd(), 'public/og.png')).size).toBeGreaterThan(50_000)
  })
})
