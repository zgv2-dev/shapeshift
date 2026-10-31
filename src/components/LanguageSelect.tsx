import { Globe2 } from 'lucide-react'
import { LANGUAGES } from '../i18n/languages'
import { useStore } from '../state/store'

export function LanguageSelect() {
  const language = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)

  return (
    <label className="language-select" data-i18n-skip>
      <Globe2 size={12} aria-hidden="true" />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        aria-label="Language"
      >
        {LANGUAGES.map((entry) => (
          <option key={entry.id} value={entry.id} lang={entry.html}>
            {entry.label}
          </option>
        ))}
      </select>
    </label>
  )
}
