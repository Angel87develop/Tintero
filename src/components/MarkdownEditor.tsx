import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { autocompletion, type CompletionContext, type CompletionResult, type CompletionSource } from '@codemirror/autocomplete'
import { Prec } from '@codemirror/state'
import { comboToCM, shortcutOf, type Settings } from '../settings'
import { assistExtension, assistSources } from '../markdownAssist'
import { tags as t } from '@lezer/highlight'

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontFamily: 'var(--serif)', fontSize: '1.6em', fontWeight: '500', color: 'var(--h)' },
  { tag: t.heading2, fontFamily: 'var(--serif)', fontSize: '1.35em', fontWeight: '500', color: 'var(--h)' },
  { tag: t.heading3, fontFamily: 'var(--serif)', fontSize: '1.15em', fontWeight: '500', fontStyle: 'italic', color: 'var(--h)' },
  { tag: [t.heading4, t.heading5, t.heading6], fontFamily: 'var(--serif)', fontWeight: '500', color: 'var(--h)' },
  { tag: t.strong, fontWeight: '600', color: 'var(--fg-strong)' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: 'var(--accent)' },
  { tag: t.url, color: 'var(--muted)' },
  { tag: t.monospace, color: 'var(--code)', fontFamily: 'var(--mono)' },
  { tag: t.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta], color: 'var(--muted)' },
  { tag: t.list, color: 'var(--accent)' },
  { tag: t.keyword, color: 'var(--syn-kw)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-str)' },
  { tag: [t.number, t.bool, t.atom], color: 'var(--syn-num)' },
  { tag: t.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-fn)' },
  { tag: [t.typeName, t.className], color: 'var(--syn-type)' },
])

const theme = EditorView.theme({
  '&': { height: '100%', background: 'transparent', color: 'var(--fg)', fontSize: 'var(--editor-size, 15px)' },
  '.cm-scroller': { overflow: 'auto', scrollPaddingBottom: '80px' },
  '.cm-content': { fontFamily: 'var(--editor-font, var(--sans))', padding: '22px 0 40vh', caretColor: 'var(--accent)', maxWidth: 'var(--content-w, 780px)', width: '100%', margin: '0 auto' },
  '.cm-line': { padding: '0 32px', lineHeight: 'var(--editor-lh, 1.75)' },
  '.cm-gutters': { background: 'var(--bg)', border: 'none', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: '12px' },
  '.cm-activeLine': { background: 'var(--hover)' },
  '.cm-placeholder': { color: 'var(--faint)' },
  '.cm-foldPlaceholder': { background: 'none', border: 'none', color: 'var(--accent)' },
  '.cm-activeLineGutter': { background: 'transparent', color: 'var(--muted)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { background: 'var(--sel) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '1.5px' },
  '.cm-tooltip': { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '3px', overflow: 'hidden', boxShadow: 'var(--shadow)' },
  '.cm-tooltip-autocomplete > ul': { padding: '3px 0', maxHeight: '18em', fontFamily: 'var(--sans)' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '4px 12px !important', color: 'var(--fg)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { background: 'var(--hover)', color: 'var(--fg-strong)', boxShadow: 'inset 2px 0 0 var(--accent)' },
  '.cm-completionDetail': { color: 'inherit', opacity: 0.6, marginLeft: '1em', fontStyle: 'normal' },
})

const SLASH: { label: string; detail: string; insert: string; cursor?: number }[] = [
  { label: '/h1', detail: 'Título 1', insert: '# ' },
  { label: '/h2', detail: 'Título 2', insert: '## ' },
  { label: '/h3', detail: 'Título 3', insert: '### ' },
  { label: '/tarea', detail: 'Lista de tareas', insert: '- [ ] ' },
  { label: '/lista', detail: 'Lista con viñetas', insert: '- ' },
  { label: '/numerada', detail: 'Lista numerada', insert: '1. ' },
  { label: '/cita', detail: 'Cita', insert: '> ' },
  { label: '/codigo', detail: 'Bloque de código', insert: '```ts\n\n```', cursor: 6 },
  { label: '/tabla', detail: 'Tabla', insert: '| Columna | Columna |\n| --- | --- |\n|  |  |' },
  { label: '/nota', detail: 'Alerta: nota', insert: '> [!NOTE]\n> ' },
  { label: '/consejo', detail: 'Alerta: consejo', insert: '> [!TIP]\n> ' },
  { label: '/atencion', detail: 'Alerta: atención', insert: '> [!WARNING]\n> ' },
  { label: '/diagrama', detail: 'Diagrama Mermaid', insert: '```mermaid\nflowchart LR\n  A[Idea] --> B[Nota]\n```', cursor: 11 },
  { label: '/formula', detail: 'Fórmula en bloque', insert: '$$\n\n$$', cursor: 3 },
  { label: '/separador', detail: 'Línea horizontal', insert: '---\n' },
  { label: '/fecha', detail: 'Fecha de hoy', insert: '' },
]

function slashSource(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  const before = line.text.slice(0, ctx.pos - line.from)
  const m = before.match(/^\s*\/[\wáéíóú]*$/)
  if (!m) return null
  const from = line.from + before.indexOf('/')
  return {
    from,
    filter: true,
    options: SLASH.map((c) => ({
      label: c.label,
      detail: c.detail,
      apply: (view: EditorView, _c: unknown, f: number, to: number) => {
        const text = c.label === '/fecha' ? new Date().toLocaleDateString('es') : c.insert
        view.dispatch({
          changes: { from: f, to, insert: text },
          selection: { anchor: f + (c.cursor ?? text.length) },
        })
      },
    })),
  }
}

const EMOJI: Record<string, string> = {
  smile: '😄', rocket: '🚀', bug: '🐛', fire: '🔥', check: '✅', x: '❌', warning: '⚠️', bulb: '💡',
  memo: '📝', star: '⭐', heart: '❤️', thinking: '🤔', tada: '🎉', eyes: '👀', wave: '👋', zap: '⚡',
  lock: '🔒', book: '📖', pin: '📌', coffee: '☕', sparkles: '✨', thumbsup: '👍', calendar: '📅', gear: '⚙️',
}

function emojiSource(ctx: CompletionContext): CompletionResult | null {
  const w = ctx.matchBefore(/:[a-z_]{2,}$/)
  if (!w) return null
  return {
    from: w.from,
    options: Object.entries(EMOJI).map(([k, v]) => ({ label: `:${k}:`, detail: v, apply: v })),
  }
}

export function wrap(view: EditorView, before: string, after = before) {
  const { from, to } = view.state.selection.main
  const sel = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: before + sel + after },
    selection: { anchor: from + before.length, head: from + before.length + sel.length },
  })
  view.focus()
}

export function linePrefix(view: EditorView, prefix: string) {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const has = line.text.startsWith(prefix)
  view.dispatch({
    changes: has
      ? { from: line.from, to: line.from + prefix.length, insert: '' }
      : { from: line.from, insert: prefix },
  })
  view.focus()
}

export function MarkdownEditor({
  value,
  onChange,
  onView,
  lineNumbers,
  settings,
}: {
  value: string
  onChange: (v: string) => void
  onView: (v: EditorView) => void
  lineNumbers: boolean
  settings: Settings
}) {
  const { slashCommands, emojiCompletion, markdownAssist, spellcheck } = settings
  const keys = (['bold', 'italic', 'inlineCode', 'strike', 'link'] as const).map((id) => shortcutOf(settings, id)).join('|')
  const extensions = useMemo(() => {
    const sources: CompletionSource[] = []
    if (slashCommands) sources.push(slashSource)
    if (emojiCompletion) sources.push(emojiSource)
    if (markdownAssist) sources.push(...assistSources)
    const [bold, italic, inlineCode, strike, link] = keys.split('|')
    const bind = (combo: string, fn: (v: EditorView) => void) => (combo ? [{ key: comboToCM(combo), run: (v: EditorView) => (fn(v), true) }] : [])
    return [
      // Va antes de markdown() para decidir primero qué hacen Enter y Retroceso.
      ...(markdownAssist ? [assistExtension] : []),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(highlight),
      theme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: spellcheck ? 'true' : 'false', lang: 'es' }),
      ...(sources.length ? [autocompletion({ override: sources, icons: false })] : []),
      Prec.high(keymap.of([
        ...bind(bold, (v) => wrap(v, '**')),
        ...bind(italic, (v) => wrap(v, '_')),
        ...bind(inlineCode, (v) => wrap(v, '`')),
        ...bind(strike, (v) => wrap(v, '~~')),
        ...bind(link, (v) => wrap(v, '[', '](https://)')),
      ])),
    ]
  }, [slashCommands, emojiCompletion, markdownAssist, spellcheck, keys])
  return (
    <CodeMirror
      className="cm-host"
      value={value}
      onChange={onChange}
      onCreateEditor={onView}
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers,
        foldGutter: lineNumbers,
        highlightActiveLine: settings.highlightActiveLine,
        highlightActiveLineGutter: settings.highlightActiveLine,
        autocompletion: false,
      }}
      height="100%"
    />
  )
}
