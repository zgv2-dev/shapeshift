import { describe, expect, it } from 'vitest'
import { LANGUAGES, normalizeLanguage } from '../src/i18n/languages'
import { translateText } from '../src/i18n/translate'
import { readFileSync } from 'node:fs'

describe('language support', () => {
  it('mirrors the nine Codex languages', () => {
    expect(LANGUAGES.map((language) => language.id)).toEqual([
      'en', 'uk', 'zh-Hans', 'zh-Hant', 'de', 'fr', 'it', 'es', 'ja',
    ])
  })

  it('normalizes browser and legacy language tags', () => {
    expect(normalizeLanguage('zh-CN')).toBe('zh-Hans')
    expect(normalizeLanguage('zh_TW')).toBe('zh-Hant')
    expect(normalizeLanguage('de-DE')).toBe('de')
    expect(normalizeLanguage('xx')).toBeNull()
  })

  it('translates UI, shape names and block units', () => {
    expect(translateText('de', 'Shape library')).toBe('Formenbibliothek')
    expect(translateText('ja', 'Torus')).toBe('トーラス')
    expect(translateText('zh-Hans', 'Torus')).toBe('环面')
    expect(translateText('es', 'Minecraft shapes')).toBe('Formas de Minecraft')
    expect(translateText('de', '2,885 blocks')).toBe('2,885 Blöcke')
    expect(translateText('de', 'Minecraft 26.3 textures loaded — 62 block textures')).toBe(
      'Minecraft-Texturen geladen — 62 Blocktexturen',
    )
  })

  it('keeps the brand name intact', () => {
    expect(translateText('zh-Hans', 'Is Shapeshift free?')).toContain('Shapeshift')
    expect(translateText('it', 'Observatory — Shapeshift')).toContain('Shapeshift')
    expect(translateText('de', 'Open studio')).toBe('Studio öffnen')
  })

  it('ships all language alternates and cross-links', () => {
    const landing = readFileSync('index.html', 'utf8')
    expect((landing.match(/hreflang=/g) ?? []).length).toBeGreaterThanOrEqual(9)
    expect(landing).toContain('https://enchantments.mc.zgv2.dev/')
    expect(landing).toContain('https://enchantments.mc.zgv2.dev/#aqua_affinity')
    expect(landing).toContain('From the same workshop')
    expect(landing).toContain('id="language-select"')
  })

  it('keeps every language populated for core UI and block labels', () => {
    for (const { id } of LANGUAGES.filter((language) => language.id !== 'en')) {
      expect(translateText(id, 'Language')).not.toBe('Language')
      expect(translateText(id, 'Choose a form')).not.toBe('Choose a form')
      expect(translateText(id, 'Smooth stone')).not.toBe('Smooth stone')
    }
  })
})
