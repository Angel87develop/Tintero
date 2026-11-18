import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { SortKey, ThemeId, ViewMode } from './types'

/* ---------------------------------------------------------------------------
 * Temas
 * ------------------------------------------------------------------------- */

/** Colores editables de un tema. Los demás (acento suave, selección…) se derivan. */
export const THEME_TOKENS = [
  { group: 'Fondos', items: [
    { key: 'bg', label: 'Fondo principal' },
    { key: 'side', label: 'Barra lateral' },
    { key: 'list', label: 'Lista de notas' },
    { key: 'panel', label: 'Paneles y menús' },
    { key: 'border', label: 'Bordes' },
  ] },
  { group: 'Texto', items: [
    { key: 'fg', label: 'Texto' },
    { key: 'h', label: 'Títulos' },
    { key: 'muted', label: 'Texto secundario' },
    { key: 'faint', label: 'Texto tenue' },
  ] },
  { group: 'Acento', items: [
    { key: 'accent', label: 'Color de acento' },
    { key: 'on-accent', label: 'Texto sobre acento' },
    { key: 'danger', label: 'Peligro' },
  ] },
  { group: 'Código', items: [
    { key: 'code', label: 'Código en línea' },
    { key: 'code-bg', label: 'Fondo de código' },
    { key: 'syn-kw', label: 'Palabras clave' },
    { key: 'syn-str', label: 'Cadenas' },
    { key: 'syn-num', label: 'Números' },
    { key: 'syn-fn', label: 'Funciones' },
    { key: 'syn-type', label: 'Tipos' },
  ] },
] as const

export type ThemeToken = (typeof THEME_TOKENS)[number]['items'][number]['key']

export interface CustomTheme {
  id: string
  name: string
  base: ThemeId
  colors: Partial<Record<ThemeToken, string>>
}

export const BUILTIN_THEMES: { id: ThemeId; label: string; dark: boolean; swatch: string[] }[] = [
  { id: 'tinta', label: 'Tinta', dark: true, swatch: ['#1b1916', '#24211c', '#e5805a', '#d9d0bf'] },
  { id: 'papel', label: 'Papel', dark: false, swatch: ['#f7f2e7', '#efe8d9', '#a8321c', '#2b2721'] },
  { id: 'fiordo', label: 'Fiordo', dark: true, swatch: ['#1f262b', '#293238', '#e0a458', '#ced8da'] },
  { id: 'bosque', label: 'Bosque', dark: true, swatch: ['#1c211b', '#262c24', '#c9b15e', '#d5d9c8'] },
]

/* ---------------------------------------------------------------------------
 * Atajos
 * ------------------------------------------------------------------------- */

export const SHORTCUTS = [
  { id: 'palette', group: 'General', label: 'Paleta de comandos', def: 'Ctrl+K' },
  { id: 'settings', group: 'General', label: 'Abrir configuración', def: 'Ctrl+,' },
  { id: 'newNote', group: 'General', label: 'Nueva nota', def: 'Ctrl+N' },
  { id: 'search', group: 'General', label: 'Buscar notas', def: 'Ctrl+Shift+F' },
  { id: 'sidebar', group: 'General', label: 'Mostrar/ocultar barra lateral', def: 'Ctrl+\\' },
  { id: 'cycleView', group: 'Vista', label: 'Cambiar modo de vista', def: 'Ctrl+E' },
  { id: 'viewEdit', group: 'Vista', label: 'Vista: solo editor', def: '' },
  { id: 'viewSplit', group: 'Vista', label: 'Vista: dividida', def: '' },
  { id: 'viewPreview', group: 'Vista', label: 'Vista: solo vista previa', def: '' },
  { id: 'zoomIn', group: 'Vista', label: 'Acercar', def: 'Ctrl+=' },
  { id: 'zoomOut', group: 'Vista', label: 'Alejar', def: 'Ctrl+-' },
  { id: 'zoomReset', group: 'Vista', label: 'Tamaño real', def: 'Ctrl+0' },
  { id: 'bold', group: 'Editor', label: 'Negrita', def: 'Ctrl+B' },
  { id: 'italic', group: 'Editor', label: 'Cursiva', def: 'Ctrl+I' },
  { id: 'inlineCode', group: 'Editor', label: 'Código en línea', def: 'Ctrl+Shift+K' },
  { id: 'strike', group: 'Editor', label: 'Tachado', def: 'Ctrl+Shift+X' },
  { id: 'link', group: 'Editor', label: 'Enlace', def: 'Ctrl+L' },
] as const

export type ShortcutId = (typeof SHORTCUTS)[number]['id']
export const EDITOR_SHORTCUTS: ShortcutId[] = ['bold', 'italic', 'inlineCode', 'strike', 'link']

const KEY_NAMES: Record<string, string> = { ' ': 'Space', '+': '=', Escape: 'Esc' }

/** Convierte una pulsación en texto tipo "Ctrl+Shift+F". Devuelve null si solo se pulsó un modificador. */
export function comboFromEvent(e: KeyboardEvent | ReactKeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return null
  let key = KEY_NAMES[e.key] ?? e.key
  // Con Shift, e.key cambia ("?" en vez de "/"); usamos la tecla física cuando es letra o número.
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5)
  else if (key.length === 1) key = key.toUpperCase()
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  // "+" se escribe con Shift en muchos teclados: Ctrl+Shift+= y Ctrl++ cuentan como Ctrl+=
  if (e.shiftKey && key !== '=') parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

/** "Ctrl+Shift+K" → "Mod-Shift-k" (formato de CodeMirror). */
export function comboToCM(combo: string): string {
  const parts = combo.split(/\+(?!$)/)
  const key = parts.pop()!
  const mods = parts.map((p) => (p === 'Ctrl' ? 'Mod' : p))
  return [...mods, key.length === 1 ? key.toLowerCase() : key].join('-')
}

/* ---------------------------------------------------------------------------
 * Configuración
 * ------------------------------------------------------------------------- */

export type EditorFont = 'sans' | 'serif' | 'mono' | 'custom'

export interface Settings {
  customThemes: CustomTheme[]
  uiFontSize: number
  editorFont: EditorFont
  customFont: string
  editorFontSize: number
  lineHeight: number
  contentWidth: number
  previewFontSize: number
  zoom: number
  defaultViewMode: ViewMode
  lineNumbers: boolean
  spellcheck: boolean
  highlightActiveLine: boolean
  slashCommands: boolean
  emojiCompletion: boolean
  markdownAssist: boolean
  showToolbar: boolean
  showFooter: boolean
  confirmDelete: boolean
  defaultSort: SortKey
  shortcuts: Partial<Record<ShortcutId, string>>
}

export const DEFAULT_SETTINGS: Settings = {
  customThemes: [],
  uiFontSize: 14,
  editorFont: 'serif',
  customFont: '',
  editorFontSize: 15,
  lineHeight: 1.75,
  contentWidth: 780,
  previewFontSize: 15,
  zoom: 1,
  defaultViewMode: 'split',
  lineNumbers: false,
  spellcheck: true,
  highlightActiveLine: true,
  slashCommands: true,
  emojiCompletion: true,
  markdownAssist: true,
  showToolbar: true,
  showFooter: true,
  confirmDelete: true,
  defaultSort: 'updatedAt',
  shortcuts: {},
}

export const shortcutOf = (s: Settings, id: ShortcutId) =>
  s.shortcuts[id] ?? SHORTCUTS.find((x) => x.id === id)!.def

const FONT_STACK: Record<Exclude<EditorFont, 'custom'>, string> = {
  sans: 'var(--sans)',
  serif: 'var(--serif)',
  mono: 'var(--mono)',
}

/** Vuelca tema, colores personalizados y tipografía como variables CSS en <html>. */
export function applyAppearance(theme: string, s: Settings) {
  const root = document.documentElement
  const custom = s.customThemes.find((t) => t.id === theme)
  root.dataset.theme = custom ? custom.base : BUILTIN_THEMES.some((t) => t.id === theme) ? theme : 'tinta'
  // limpia overrides anteriores
  for (const g of THEME_TOKENS) for (const t of g.items) root.style.removeProperty(`--${t.key}`)
  for (const k of ['--accent-soft', '--sel', '--fg-strong']) root.style.removeProperty(k)
  if (custom) {
    for (const [k, v] of Object.entries(custom.colors)) if (v) root.style.setProperty(`--${k}`, v)
    if (custom.colors.accent) {
      root.style.setProperty('--accent-soft', `${custom.colors.accent}22`)
      root.style.setProperty('--sel', `${custom.colors.accent}40`)
    }
    if (custom.colors.h) root.style.setProperty('--fg-strong', custom.colors.h)
  }
  const font = s.editorFont === 'custom' ? `${s.customFont || 'inherit'}, var(--sans)` : FONT_STACK[s.editorFont]
  root.style.setProperty('--ui-size', `${s.uiFontSize}px`)
  root.style.setProperty('--editor-font', font)
  root.style.setProperty('--editor-size', `${s.editorFontSize}px`)
  root.style.setProperty('--editor-lh', String(s.lineHeight))
  root.style.setProperty('--content-w', `${s.contentWidth}px`)
  root.style.setProperty('--preview-size', `${s.previewFontSize}px`)
}

/** Clave que cambia cuando cambian los colores efectivos (para la caché de Mermaid). */
export function themeKey(theme: string, s: Settings) {
  const custom = s.customThemes.find((t) => t.id === theme)
  return custom ? `${custom.base}:${JSON.stringify(custom.colors)}` : theme
}

export function isDarkTheme(theme: string, s: Settings) {
  const base = s.customThemes.find((t) => t.id === theme)?.base ?? theme
  return BUILTIN_THEMES.find((t) => t.id === base)?.dark ?? true
}

/** Lee el valor efectivo de un token desde el CSS ya aplicado (en formato #rrggbb). */
export function currentColor(token: ThemeToken): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('')
  if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7)
  return '#888888'
}
