import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './landing.css'
import { detectLanguage, getStoredLanguage, LANGUAGES, normalizeLanguage, storeLanguage } from './i18n/languages'
import { setPageLanguage, startPageTranslator } from './i18n/domTranslate'
import { translateText } from './i18n/translate'

// Old share links pointed at the root. Keep them working by sending them to
// the studio while leaving clean campaign URLs on the landing page alone.
const params = new URLSearchParams(window.location.search)
if (params.has('shape')) {
  window.location.replace(`/studio/${window.location.search}`)
}

const select = document.querySelector<HTMLSelectElement>('#language-select')
const originalTitle = document.title
const initial =
  normalizeLanguage(params.get('lang')) ??
  getStoredLanguage() ??
  detectLanguage()
storeLanguage(initial)

if (select) {
  select.value = initial
  select.addEventListener('change', () => {
    const language = normalizeLanguage(select.value) ?? 'en'
    storeLanguage(language)
    setPageLanguage(language)
    document.title = translateText(language, originalTitle)
    select.value = language
    const next = new URLSearchParams(window.location.search)
    next.set('lang', language)
    window.history.replaceState(null, '', `${window.location.pathname}?${next}`)
  })
}

startPageTranslator(initial)
setPageLanguage(initial)
document.title = translateText(initial, originalTitle)
// Keep the native labels in their own language; the control is skipped by the translator.
document.documentElement.dataset.languages = String(LANGUAGES.length)
