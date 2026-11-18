import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { ChangeSet, EditorSelection, Prec, type ChangeSpec, type EditorState, type Extension, type Text } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

/* ---------------------------------------------------------------------------
 * Contexto
 * ------------------------------------------------------------------------- */

function insideNode(state: EditorState, pos: number, names: string[]) {
  let node: ReturnType<ReturnType<typeof syntaxTree>['resolveInner']> | null = syntaxTree(state).resolveInner(pos, -1)
  while (node) {
    if (names.includes(node.name)) return true
    node = node.parent
  }
  return false
}

const inCodeBlock = (state: EditorState, pos: number) => insideNode(state, pos, ['FencedCode', 'CodeBlock'])

/* ---------------------------------------------------------------------------
 * Tablas
 * ------------------------------------------------------------------------- */

interface Cell {
  /** Posiciones dentro de la línea, entre las dos barras. */
  from: number
  to: number
  text: string
}

interface Row {
  prefix: string
  cells: Cell[]
  closed: boolean
}

function parseRow(text: string): Row | null {
  const m = /^(\s*(?:>\s*)*)\|/.exec(text)
  if (!m) return null
  const prefix = m[1]
  const cells: Cell[] = []
  let start = prefix.length + 1
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '|') {
      cells.push({ from: start, to: i, text: text.slice(start, i) })
      start = i + 1
    }
  }
  const closed = !text.slice(start).trim()
  if (!closed) cells.push({ from: start, to: text.length, text: text.slice(start) })
  return { prefix, cells, closed }
}

const isDelimiterCell = (c: Cell) => /^\s*:?-+:?\s*$/.test(c.text)
const isBlankCell = (c: Cell) => !c.text.trim()
const isDelimiterRow = (r: Row | null) =>
  !!r && r.cells.some(isDelimiterCell) && r.cells.every((c) => isDelimiterCell(c) || isBlankCell(c))

const rowText = (prefix: string, cells: string[]) => `${prefix}| ${cells.join(' | ')} |`
const emptyRow = (prefix: string, columns: number) => rowText(prefix, Array<string>(columns).fill(''))

/** Completa la barra final y las celdas que falten; si la fila ya está bien, no la toca. */
function fitRow(text: string, row: Row, columns: number) {
  if (row.closed && row.cells.length >= columns) return text
  const cells = row.cells.map((c) => c.text.trim())
  while (cells.length < columns) cells.push('')
  return rowText(row.prefix, cells)
}

function tableAt(doc: Text, lineNumber: number) {
  let first = lineNumber
  let last = lineNumber
  while (first > 1 && parseRow(doc.line(first - 1).text)) first--
  while (last < doc.lines && parseRow(doc.line(last + 1).text)) last++
  const hasDelimiter = last > first && isDelimiterRow(parseRow(doc.line(first + 1).text))
  const columns = parseRow(doc.line(first).text)?.cells.length ?? 0
  return { first, last, hasDelimiter, columns }
}

function tableEnter(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty || inCodeBlock(state, sel.head)) return false
  const line = state.doc.lineAt(sel.head)
  const row = parseRow(line.text)
  if (!row) return false
  const { prefix } = row
  const table = tableAt(state.doc, line.number)
  const replaceLine = (insert: string, anchor: number) => {
    view.dispatch({ changes: { from: line.from, to: line.to, insert }, selection: { anchor }, scrollIntoView: true, userEvent: 'input' })
    return true
  }

  // Encabezado recién escrito: añade el separador y la primera fila.
  if (!table.hasDelimiter) {
    if (table.first !== table.last || sel.head < line.from + line.text.trimEnd().length) return false
    if (row.cells.every(isBlankCell) || (row.cells.length < 2 && !row.closed)) return false
    const columns = row.cells.length
    const head = fitRow(line.text, row, columns)
    const delimiter = rowText(prefix, Array<string>(columns).fill('---'))
    const insert = [head, delimiter, emptyRow(prefix, columns)].join('\n')
    return replaceLine(insert, line.from + head.length + delimiter.length + 2 + prefix.length + 2)
  }

  const body = emptyRow(prefix, table.columns)

  // Separador a medio escribir: lo completa y baja a la primera fila.
  if (line.number === table.first + 1) {
    const cells = Array.from({ length: table.columns }, (_, i) => row.cells[i]?.text.trim() || '---')
    const delimiter = rowText(prefix, cells)
    if (table.last > line.number) {
      const next = state.doc.line(line.number + 1)
      const nextRow = parseRow(next.text)!
      const offset = delimiter.length - line.text.length
      return replaceLine(delimiter, next.from + offset + (nextRow.cells[0]?.from ?? prefix.length + 1) + 1)
    }
    return replaceLine(`${delimiter}\n${body}`, line.from + delimiter.length + 1 + prefix.length + 2)
  }

  // Desde el encabezado: abre una fila justo debajo del separador.
  if (line.number === table.first) {
    const at = state.doc.line(line.number + 1).to
    view.dispatch({ changes: { from: at, insert: `\n${body}` }, selection: { anchor: at + 1 + prefix.length + 2 }, scrollIntoView: true, userEvent: 'input' })
    return true
  }

  // Última fila vacía: sale de la tabla dejando una línea en blanco.
  if (line.number === table.last && row.cells.every(isBlankCell)) {
    const insert = `${prefix.trimEnd()}\n${prefix}`
    return replaceLine(insert, line.from + insert.length)
  }

  const fixed = fitRow(line.text, row, table.columns)
  return replaceLine(`${fixed}\n${body}`, line.from + fixed.length + 1 + prefix.length + 2)
}

function tableTab(view: EditorView, dir: 1 | -1) {
  const { state } = view
  const sel = state.selection.main
  if (inCodeBlock(state, sel.head)) return false
  const line = state.doc.lineAt(sel.head)
  if (state.doc.lineAt(sel.anchor).number !== line.number) return false
  const row = parseRow(line.text)
  if (!row) return false
  const table = tableAt(state.doc, line.number)
  if (!table.hasDelimiter) return false

  const delimiterLine = table.first + 1
  const offset = sel.head - line.from
  const current = row.cells.findIndex((c) => offset <= c.to)
  let target = line.number
  let column = (current < 0 ? row.cells.length - 1 : current) + dir
  if (line.number === delimiterLine || column < 0 || column >= table.columns) {
    target += dir
    if (target === delimiterLine) target += dir
    column = dir > 0 ? 0 : table.columns - 1
  }
  if (target < table.first) return true

  let changes = state.changes(
    line.number === delimiterLine ? [] : { from: line.from, to: line.to, insert: fitRow(line.text, row, table.columns) },
  )
  let doc = changes.apply(state.doc)
  if (target > table.last) {
    const added = ChangeSet.of({ from: doc.line(table.last).to, insert: `\n${emptyRow(row.prefix, table.columns)}` }, doc.length)
    changes = changes.compose(added)
    doc = added.apply(doc)
  }

  const targetLine = doc.line(target)
  const targetRow = parseRow(targetLine.text)!
  const cell = targetRow.cells[Math.min(column, targetRow.cells.length - 1)]
  const trimmed = cell.text.trim()
  const start = targetLine.from + cell.from
  const selection = trimmed
    ? EditorSelection.single(start + cell.text.indexOf(trimmed), start + cell.text.indexOf(trimmed) + trimmed.length)
    : EditorSelection.single(start + Math.min(1, cell.to - cell.from))
  view.dispatch({ changes, selection, scrollIntoView: true, userEvent: 'input' })
  return true
}

/* ---------------------------------------------------------------------------
 * Listas
 * ------------------------------------------------------------------------- */

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)/
const indentOf = (text: string) => /^\s*/.exec(text)![0].length

/** Devuelve cuánto hay que desplazar el elemento, o null si no se puede mover. */
function listShift(doc: Text, lineNumber: number, indent: number, dir: 1 | -1) {
  if (dir < 0 && indent === 0) return null
  for (let n = lineNumber - 1; n >= 1; n--) {
    const text = doc.line(n).text
    if (!text.trim()) continue
    const m = LIST_ITEM.exec(text)
    if (!m) {
      if (indentOf(text) > 0) continue
      break
    }
    const other = m[1].length
    if (dir > 0) {
      if (other === indent) return m[0].length - other
      if (other < indent) return null
    } else if (other < indent) {
      return indent - other
    }
  }
  return dir < 0 ? indent : null
}

/** Reajusta la numeración de la lista que contiene la línea indicada. */
function renumberList(doc: Text, lineNumber: number, restarted: Set<number>) {
  const belongs = (text: string) => !text.trim() || LIST_ITEM.test(text) || /^\s/.test(text)
  let first = lineNumber
  let last = lineNumber
  while (first > 1 && belongs(doc.line(first - 1).text)) first--
  while (last < doc.lines && belongs(doc.line(last + 1).text)) last++

  const levels: { indent: number; ordered: boolean; next: number }[] = []
  const changes: ChangeSpec[] = []
  for (let n = first; n <= last; n++) {
    const line = doc.line(n)
    const m = LIST_ITEM.exec(line.text)
    if (!m) continue
    const indent = m[1].length
    const ordered = /^\d/.test(m[2])
    const own = ordered ? parseInt(m[2], 10) : 0
    while (levels.length && levels[levels.length - 1].indent > indent) levels.pop()
    let level = levels[levels.length - 1]
    if (level?.indent === indent && level.ordered !== ordered) {
      levels.pop()
      level = levels[levels.length - 1]
    }
    let value = own
    if (level?.indent === indent) value = level.next
    else {
      if (restarted.has(n)) value = 1
      level = { indent, ordered, next: value }
      levels.push(level)
    }
    level.next = value + 1
    if (ordered && value !== own) {
      const digits = m[2].length - 1
      changes.push({ from: line.from + indent, to: line.from + indent + digits, insert: String(value) })
    }
  }
  return ChangeSet.of(changes, doc.length)
}

function listTab(view: EditorView, dir: 1 | -1) {
  const { state } = view
  const { doc } = state
  const sel = state.selection.main
  if (inCodeBlock(state, sel.head)) return false
  const startLine = doc.lineAt(sel.from).number
  const endPos = !sel.empty && doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to
  const endLine = doc.lineAt(endPos).number
  for (let n = startLine; n <= endLine; n++) if (!LIST_ITEM.test(doc.line(n).text)) return false

  const indent = indentOf(doc.line(startLine).text)
  const shift = listShift(doc, startLine, indent, dir)
  // Tab se consume aunque no se pueda mover: así no se convierte en bloque de código.
  if (shift === null) return true

  // Los subelementos se mueven con su elemento.
  let lastMoved = endLine
  for (let n = endLine + 1; n <= doc.lines; n++) {
    const text = doc.line(n).text
    if (text.trim()) {
      if (indentOf(text) <= indent) break
      lastMoved = n
    }
  }

  const moves: ChangeSpec[] = []
  for (let n = startLine; n <= lastMoved; n++) {
    const line = doc.line(n)
    if (!line.text.trim()) continue
    if (dir > 0) moves.push({ from: line.from, insert: ' '.repeat(shift) })
    else moves.push({ from: line.from, to: line.from + Math.min(shift, indentOf(line.text)) })
  }
  const moved = state.changes(moves)
  const restarted = new Set<number>()
  if (dir > 0) for (let n = startLine; n <= endLine; n++) restarted.add(n)
  const changes = moved.compose(renumberList(moved.apply(doc), startLine, restarted))
  view.dispatch({ changes, selection: state.selection.map(changes, 1), scrollIntoView: true, userEvent: dir > 0 ? 'input.indent' : 'delete.dedent' })
  return true
}

/* ---------------------------------------------------------------------------
 * Bloques de código y fórmulas
 * ------------------------------------------------------------------------- */

const FENCE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/

/** Indica si la línea abre un bloque de código que todavía no tiene cierre. */
function opensUnclosedFence(doc: Text, lineNumber: number) {
  let open: { char: string; length: number } | null = null
  let opener = false
  for (let n = 1; n <= doc.lines; n++) {
    const m = FENCE.exec(doc.line(n).text)
    if (!m || (m[2][0] === '`' && m[3].includes('`'))) continue
    if (!open) {
      open = { char: m[2][0], length: m[2].length }
      if (n === lineNumber) opener = true
    } else if (m[2][0] === open.char && m[2].length >= open.length && !m[3].trim()) {
      open = null
    }
  }
  return opener && open !== null
}

function closeFence(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = state.doc.lineAt(sel.head)
  if (sel.head !== line.to) return false
  const m = FENCE.exec(line.text)
  if (!m || !opensUnclosedFence(state.doc, line.number)) return false
  const insert = `\n${m[1]}\n${m[1]}${m[2]}`
  view.dispatch({ changes: { from: sel.head, insert }, selection: { anchor: sel.head + 1 + m[1].length }, scrollIntoView: true, userEvent: 'input' })
  return true
}

function closeMathBlock(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty || inCodeBlock(state, sel.head)) return false
  const line = state.doc.lineAt(sel.head)
  if (sel.head !== line.to || line.text.trim() !== '$$') return false
  let marks = 0
  for (let n = 1; n <= state.doc.lines; n++) if (state.doc.line(n).text.trim() === '$$') marks++
  if (marks % 2 === 0) return false
  const indent = /^\s*/.exec(line.text)![0]
  view.dispatch({ changes: { from: sel.head, insert: `\n${indent}\n${indent}$$` }, selection: { anchor: sel.head + 1 + indent.length }, scrollIntoView: true, userEvent: 'input' })
  return true
}

/* ---------------------------------------------------------------------------
 * Pares de formato y casillas de tarea
 * ------------------------------------------------------------------------- */

const WRAPPERS = '*_~`$'
const isWord = (char: string) => /[\p{L}\p{N}]/u.test(char)

function typed(view: EditorView, from: number, to: number, insert: string, anchor: number, head = anchor) {
  view.dispatch({ changes: { from, to, insert }, selection: { anchor, head }, scrollIntoView: true, userEvent: 'input.type' })
  return true
}

function handleTyping(view: EditorView, from: number, to: number, text: string) {
  const { state } = view
  if (view.compositionStarted || state.readOnly || state.selection.ranges.length > 1) return false
  const sel = state.selection.main
  if (sel.from !== from || sel.to !== to || text.length !== 1) return false
  if (inCodeBlock(state, from)) return false

  if (!sel.empty) {
    if (!WRAPPERS.includes(text)) return false
    view.dispatch({
      changes: [{ from, insert: text }, { from: to, insert: text }],
      selection: { anchor: sel.anchor + 1, head: sel.head + 1 },
      userEvent: 'input.type',
    })
    return true
  }

  const line = state.doc.lineAt(from)
  const before = line.text.slice(0, from - line.from)
  const after = line.text.slice(from - line.from)
  const prev = before.slice(-1)
  const next = after.slice(0, 1)

  // "- [" + espacio → "- [ ] "; "[" + espacio al inicio de línea crea la tarea completa.
  if (text === ' ') {
    const m = /^(\s*(?:>\s*)*)((?:[-*+]|\d+[.)])\s+)?\[$/.exec(before)
    if (!m || (after !== ']' && after !== '')) return false
    const insert = `${m[1]}${m[2] ?? '- '}[ ] `
    return typed(view, line.from, line.to, insert, line.from + insert.length)
  }

  if (text === '`') {
    if (next === '`') return typed(view, from, from + 1, '`', from + 1)
    if (prev === '`' || isWord(prev) || isWord(next) || insideNode(state, from, ['InlineCode'])) return false
    return typed(view, from, to, '``', from + 1)
  }

  if (text === '*' || text === '~') {
    if (insideNode(state, from, ['InlineCode'])) return false
    if (next === text && before.includes(text)) return typed(view, from, from + 1, text, from + 1)
    const beforePrev = before.slice(-2, -1)
    if (prev !== text || beforePrev === text || isWord(beforePrev) || isWord(next)) return false
    return typed(view, from, to, text.repeat(3), from + 1)
  }

  return false
}

function deletePair(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty || inCodeBlock(state, sel.head)) return false
  for (const pair of ['**', '~~', '`']) {
    const size = pair.length
    if (state.sliceDoc(sel.head - size, sel.head) === pair && state.sliceDoc(sel.head, sel.head + size) === pair) {
      view.dispatch({ changes: { from: sel.head - size, to: sel.head + size }, userEvent: 'delete.backward' })
      return true
    }
  }
  return false
}

/* ---------------------------------------------------------------------------
 * Sugerencias
 * ------------------------------------------------------------------------- */

const CODE_LANGUAGES: [string, string][] = [
  ['ts', 'TypeScript'], ['tsx', 'TSX'], ['js', 'JavaScript'], ['jsx', 'JSX'], ['json', 'JSON'],
  ['html', 'HTML'], ['css', 'CSS'], ['scss', 'SCSS'], ['bash', 'Bash'], ['shell', 'Shell'],
  ['powershell', 'PowerShell'], ['python', 'Python'], ['rust', 'Rust'], ['go', 'Go'], ['java', 'Java'],
  ['kotlin', 'Kotlin'], ['swift', 'Swift'], ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'],
  ['php', 'PHP'], ['ruby', 'Ruby'], ['sql', 'SQL'], ['yaml', 'YAML'], ['toml', 'TOML'],
  ['xml', 'XML'], ['markdown', 'Markdown'], ['diff', 'Diff'], ['mermaid', 'Diagrama Mermaid'], ['math', 'Fórmula KaTeX'],
]

function fenceLanguageSource(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  if (ctx.pos !== line.to) return null
  const m = /^\s{0,3}(?:`{3,}|~{3,})([\w+#-]+)$/.exec(line.text)
  if (!m || !opensUnclosedFence(ctx.state.doc, line.number)) return null
  return {
    from: ctx.pos - m[1].length,
    validFor: /^[\w+#-]*$/,
    options: CODE_LANGUAGES.map(([label, detail]): Completion => ({
      label,
      detail,
      apply: (view, _completion, from, to) => {
        view.dispatch({ changes: { from, to, insert: label }, selection: { anchor: from + label.length } })
        closeFence(view)
      },
    })),
  }
}

const ALERT_KINDS: [string, string][] = [
  ['NOTE', 'Nota'], ['TIP', 'Consejo'], ['IMPORTANT', 'Importante'], ['WARNING', 'Atención'], ['CAUTION', 'Precaución'],
]

function alertSource(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  const m = /^(\s*(?:>\s*)+)\[!\w*$/.exec(line.text.slice(0, ctx.pos - line.from))
  if (!m) return null
  return {
    from: line.from + m[1].length,
    validFor: /^\[!\w*$/,
    options: ALERT_KINDS.map(([kind, detail]): Completion => ({
      label: `[!${kind}]`,
      detail,
      apply: (view, _completion, from, to) => {
        const end = view.state.sliceDoc(to, to + 1) === ']' ? to + 1 : to
        const insert = `[!${kind}]\n${m[1]}`
        view.dispatch({ changes: { from, to: end, insert }, selection: { anchor: from + insert.length } })
      },
    })),
  }
}

export const assistSources: CompletionSource[] = [fenceLanguageSource, alertSource]

/* ---------------------------------------------------------------------------
 * Extensión
 * ------------------------------------------------------------------------- */

export const assistExtension: Extension = [
  EditorView.inputHandler.of(handleTyping),
  Prec.high(keymap.of([
    { key: 'Enter', run: (v) => closeFence(v) || closeMathBlock(v) || tableEnter(v) },
    { key: 'Tab', run: (v) => tableTab(v, 1) || listTab(v, 1), shift: (v) => tableTab(v, -1) || listTab(v, -1) },
    { key: 'Backspace', run: deletePair },
  ])),
]
