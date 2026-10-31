export const LANGUAGES = [
  { id: 'en', label: 'English', html: 'en' },
  { id: 'uk', label: 'Українська', html: 'uk' },
  { id: 'zh-Hans', label: '简体中文', html: 'zh-Hans' },
  { id: 'zh-Hant', label: '繁體中文', html: 'zh-Hant' },
  { id: 'de', label: 'Deutsch', html: 'de' },
  { id: 'fr', label: 'Français', html: 'fr' },
  { id: 'it', label: 'Italiano', html: 'it' },
  { id: 'es', label: 'Español', html: 'es' },
  { id: 'ja', label: '日本語', html: 'ja' },
] as const

export type Language = (typeof LANGUAGES)[number]['id']
export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_STORAGE_KEY = 'shapeshift:language'

const IDS = new Set<string>(LANGUAGES.map((language) => language.id))

export function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null
  const raw = value.trim()
  if (IDS.has(raw)) return raw as Language
  const lower = raw.toLowerCase().replace(/_/g, '-')
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-sg' || lower === 'zhcn') return 'zh-Hans'
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower === 'zhtw') return 'zh-Hant'
  const base = lower.split('-')[0]
  return IDS.has(base) ? (base as Language) : null
}

export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate)
    if (language) return language
  }
  return DEFAULT_LANGUAGE
}

export function languageHtml(language: Language): string {
  return LANGUAGES.find((entry) => entry.id === language)?.html ?? 'en'
}

export function getStoredLanguage(): Language | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    /* storage can be unavailable */
  }
}
