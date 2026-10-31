import { languageHtml, type Language } from './languages'
import { translateText } from './translate'

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CODE', 'PRE', 'TEXTAREA', 'TITLE'])
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt']
const HEAD_ATTRS = ['content']

let language: Language = 'en'
let observer: MutationObserver | null = null
let scheduled = false
const textRecords = new WeakMap<Text, { original: string; translated: string; language: Language }>()
const attrRecords = new WeakMap<Element, Map<string, { original: string; translated: string; language: Language }>>()
const trackedText = new Set<Text>()
const trackedElements = new Set<Element>()

function isSkipped(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  if (!element) return true
  if (SKIP_TAGS.has(element.tagName)) return true
  return Boolean(element.closest('[data-i18n-skip]'))
}

function splitWhitespace(raw: string): { leading: string; core: string; trailing: string } {
  const leading = raw.match(/^\s*/)?.[0] ?? ''
  const trailing = raw.match(/\s*$/)?.[0] ?? ''
  return {
    leading,
    core: raw.slice(leading.length, raw.length - trailing.length),
    trailing,
  }
}

function translateTextNode(node: Text): void {
  if (isSkipped(node)) return
  const { leading, core, trailing } = splitWhitespace(node.nodeValue ?? '')
  if (!core || !/\p{L}/u.test(core)) return
  if (core === 'Shapeshift' || core === 'Minecraft') return
  const record = textRecords.get(node)
  if (record && core === record.translated && record.language === language) return
  if (record && core === record.original) {
    const translated = translateText(language, core)
    if (translated !== core) node.nodeValue = leading + translated + trailing
    record.translated = translated
    record.language = language
    return
  }
  const translated = translateText(language, core)
  textRecords.set(node, { original: core, translated, language })
  trackedText.add(node)
  if (translated !== core) node.nodeValue = leading + translated + trailing
}

function translateAttribute(element: Element, attr: string): void {
  if (isSkipped(element)) return
  const value = element.getAttribute(attr)
  if (!value) return
  let records = attrRecords.get(element)
  if (!records) {
    records = new Map()
    attrRecords.set(element, records)
  }
  const record = records.get(attr)
  if (record && value === record.translated && record.language === language) return
  if (record && value === record.original) {
    const translated = translateText(language, value)
    if (translated !== value) element.setAttribute(attr, translated)
    record.translated = translated
    record.language = language
    return
  }
  const translated = translateText(language, value)
  records.set(attr, { original: value, translated, language })
  trackedElements.add(element)
  if (translated !== value) element.setAttribute(attr, translated)
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return
  if (root.nodeType === Node.ELEMENT_NODE && isSkipped(root)) return
  const element = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : null
  if (element) {
    for (const attr of ATTRS) translateAttribute(element, attr)
    if (element.tagName === 'META') {
      const name = element.getAttribute('name')
      const property = element.getAttribute('property')
      if (name === 'description' || property === 'og:title' || property === 'og:description' || property === 'twitter:title' || property === 'twitter:description') {
        for (const attr of HEAD_ATTRS) translateAttribute(element, attr)
      }
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName
        if (SKIP_TAGS.has(tag) || (node as Element).closest('[data-i18n-skip]')) {
          return NodeFilter.FILTER_REJECT
        }
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let node: Node | null = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text)
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      for (const attr of ATTRS) translateAttribute(el, attr)
      if (el.tagName === 'META') {
        const name = el.getAttribute('name')
        const property = el.getAttribute('property')
        if (name === 'description' || property === 'og:title' || property === 'og:description' || property === 'twitter:title' || property === 'twitter:description') {
          for (const attr of HEAD_ATTRS) translateAttribute(el, attr)
        }
      }
    }
    node = walker.nextNode()
  }
}

function restore(): void {
  for (const node of trackedText) {
    if (!node.isConnected) continue
    const record = textRecords.get(node)
    if (!record) continue
    const { leading, core, trailing } = splitWhitespace(node.nodeValue ?? '')
    if (core === record.translated && record.translated !== record.original) {
      node.nodeValue = leading + record.original + trailing
    }
  }
  for (const element of trackedElements) {
    if (!element.isConnected) continue
    const records = attrRecords.get(element)
    if (!records) continue
    for (const [attr, record] of records) {
      if (element.getAttribute(attr) === record.translated && record.translated !== record.original) {
        element.setAttribute(attr, record.original)
      }
    }
  }
}

function apply(): void {
  scheduled = false
  walk(document.documentElement)
}

function schedule(): void {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(apply)
}

export function setPageLanguage(next: Language): void {
  language = next
  document.documentElement.lang = languageHtml(next)
  restore()
  apply()
}

export function startPageTranslator(initial: Language): void {
  language = initial
  document.documentElement.lang = languageHtml(initial)
  if (!observer) {
    observer = new MutationObserver(schedule)
    observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...ATTRS, ...HEAD_ATTRS],
    })
  }
  apply()
}
