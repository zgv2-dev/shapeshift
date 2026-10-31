import raw from './dictionary.json'
import type { Language } from './languages'

type Dictionary = Record<string, string>
const dictionaries = raw as unknown as Record<Language, Dictionary>

export function translateText(language: Language, text: string): string {
  if (language === 'en') return text
  const dictionary = dictionaries[language]
  if (!dictionary) return text
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized !== text) {
    const normalizedTranslation = dictionary[normalized]
    if (normalizedTranslation) return normalizedTranslation
  }
  const exact = dictionary[text]
  if (exact) return exact

  const count = text.match(/^([\d,.]+)\s+(blocks?|slabs?|layers?|stacks?)$/i)
  if (count) {
    const unit = count[2].toLowerCase()
    const translated = dictionary[unit]
    if (translated) return `${count[1]} ${translated}`
  }
  const percent = text.match(/^([\d.]+)\s*%\s+(blocks?|slabs?)$/i)
  if (percent) {
    const unit = percent[2].toLowerCase()
    const translated = dictionary[unit]
    if (translated) return `${percent[1]} % ${translated}`
  }
  const textures = text.match(/^Minecraft ([\d.]+) textures loaded — (\d+) block textures$/)
  if (textures) {
    return `${dictionary['Minecraft textures loaded'] ?? 'Minecraft textures loaded'} — ${textures[2]} ${dictionary['block textures'] ?? 'block textures'}`
  }
  const missing = text.match(/^Minecraft ([\d.]+) textures loaded — (\d+)\/(\d+) \((\d+) missing\)$/)
  if (missing) {
    return `${dictionary['Minecraft textures loaded'] ?? 'Minecraft textures loaded'} — ${missing[2]}/${missing[3]} (${missing[4]} ${dictionary['missing'] ?? 'missing'})`
  }
  const textureError = text.match(/^Minecraft ([\d.]+) texture mirror unreachable — using flat colors$/)
  if (textureError) {
    return `${dictionary['texture mirror unreachable'] ?? 'texture mirror unreachable'} — ${dictionary['using flat colors'] ?? 'using flat colors'}`
  }
  return text
}
