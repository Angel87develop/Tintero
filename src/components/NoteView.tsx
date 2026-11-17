import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { EditorView } from '@codemirror/view'
import type { Action } from '../store'
import { timeAgo, toggleTask } from '../store'
import type { Note, State, Status, ViewMode } from '../types'
import { STATUS_COLOR, STATUS_LABEL } from '../types'
import { MarkdownEditor, linePrefix, wrap } from './MarkdownEditor'
import { Preview } from './Preview'
import { Icon, type IconName } from './Icons'
import { headings } from '../markdown'
import { shortcutOf, type ShortcutId } from '../settings'

export function NoteView({ state, dispatch, note }: { state: State; dispatch: Dispatch<Action>; note: Note }) {
  const viewRef = useRef<EditorView | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [tagDraft, setTagDraft] = useState('')
  const [showToc, setShowToc] = useState(false)
  const st = state.settings
  const [lineNumbers, setLineNumbers] = useState(st.lineNumbers)
  useEffect(() => setLineNumbers(st.lineNumbers), [st.lineNumbers])
  const update = (patch: Partial<Note>) => dispatch({ type: 'updateNote', id: note.id, patch })
  const mode = state.viewMode

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '').replace(/\s+/g, '-')
    if (t && !note.tags.includes(t)) update({ tags: [...note.tags, t] })
    setTagDraft('')
  }

  const exportMd = () => {
    const blob = new Blob([`# ${note.title}\n\n${note.body}`], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(note.title || 'nota').replace(/[\\/:*?"<>|]/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const jumpTo = (line: number, index: number) => {
    const v = viewRef.current
    if (v && mode !== 'preview') {
      const pos = v.state.doc.line(line + 1).from
      v.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
      v.focus()
      return
    }
    // En modo vista se desplaza la vista previa hasta el título correspondiente.
    const hs = bodyRef.current?.querySelectorAll('.preview-pane .markdown-body :is(h1,h2,h3,h4,h5,h6)')
    hs?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const k = (id: ShortcutId) => (shortcutOf(st, id) ? ` (${shortcutOf(st, id)})` : '')

  const tool = (icon: IconName, title: string, fn: (v: EditorView) => void) => (
    <button
      className="tool"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => viewRef.current && fn(viewRef.current)}
    >
      <Icon name={icon} />
    </button>
  )

  if (note.trashed) {
    return (
      <main className="noteview">
        <div className="trash-banner">
          <Icon name="trash" size={15} />
          <span>Esta nota está en la papelera.</span>
          <span className="spacer" />
          <button className="btn" onClick={() => dispatch({ type: 'restoreNote', id: note.id })}>
            <Icon name="restore" size={14} /> Restaurar
          </button>
          <button className="btn danger" onClick={() => {
            if (!st.confirmDelete || confirm('¿Eliminar definitivamente? No se puede deshacer.')) dispatch({ type: 'deleteForever', id: note.id })
          }}>Eliminar para siempre</button>
        </div>
        <div className="nv-body mode-preview">
          <div className="pane preview-pane">
            <h1 className="nv-title readonly">{note.title || 'Sin título'}</h1>
            <Preview body={note.body} theme={state.theme} settings={st} onToggleTask={() => {}} />
          </div>
        </div>
      </main>
    )
  }

  const toc = headings(note.body)

  return (
    <main className="noteview">
      <header className="nv-head">
        <div className="nv-meta-row">
          <select className="pill" value={note.notebookId} onChange={(e) => update({ notebookId: e.target.value })} title="Cuaderno">
            {state.notebooks.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
          </select>
          <span className="pill status" style={{ ['--c' as string]: STATUS_COLOR[note.status] }}>
            <span className="dot" />
            <select value={note.status} onChange={(e) => update({ status: e.target.value as Status })} title="Estado">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </span>
          <div className="tags">
            {note.tags.map((t) => (
              <button key={t} className="chip removable" onClick={() => update({ tags: note.tags.filter((x) => x !== t) })} title="Quitar etiqueta">
                #{t} <Icon name="x" size={11} />
              </button>
            ))}
            <input
              className="tag-input"
              placeholder="+ etiqueta"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                if (e.key === 'Backspace' && !tagDraft && note.tags.length) update({ tags: note.tags.slice(0, -1) })
              }}
              onBlur={addTag}
            />
          </div>
          <div className="spacer" />
          <div className="nv-actions">
            <button className={`icon-btn ${note.pinned ? 'on' : ''}`} title={note.pinned ? 'Desfijar' : 'Fijar arriba'} onClick={() => update({ pinned: !note.pinned })}>
              <Icon name="pin" />
            </button>
            <button className={`icon-btn ${showToc ? 'on' : ''}`} title="Índice" onClick={() => setShowToc((v) => !v)}>
              <Icon name="toc" />
            </button>
            <button className="icon-btn" title="Exportar .md" onClick={exportMd}>
              <Icon name="download" />
            </button>
            <button className="icon-btn danger" title="Mover a la papelera" onClick={() => dispatch({ type: 'trashNote', id: note.id })}>
              <Icon name="trash" />
            </button>
          </div>
        </div>
        <input
          className="nv-title"
          placeholder="Sin título"
          autoFocus={!note.title && !note.body}
          value={note.title}
          onChange={(e) => update({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); viewRef.current?.focus() }
          }}
        />
        <div className="toolbar">
          {mode !== 'preview' && st.showToolbar && (
            <>
              {tool('bold', `Negrita${k('bold')}`, (v) => wrap(v, '**'))}
              {tool('italic', `Cursiva${k('italic')}`, (v) => wrap(v, '_'))}
              {tool('strike', `Tachado${k('strike')}`, (v) => wrap(v, '~~'))}
              {tool('heading', 'Título', (v) => linePrefix(v, '## '))}
              <span className="tool-sep" />
              {tool('code', `Código en línea${k('inlineCode')}`, (v) => wrap(v, '`'))}
              {tool('codeBlock', 'Bloque de código', (v) => wrap(v, '```ts\n', '\n```'))}
              {tool('link', `Enlace${k('link')}`, (v) => wrap(v, '[', '](https://)'))}
              <span className="tool-sep" />
              {tool('task', 'Tarea', (v) => linePrefix(v, '- [ ] '))}
              {tool('bullets', 'Lista', (v) => linePrefix(v, '- '))}
              {tool('quote', 'Cita', (v) => linePrefix(v, '> '))}
              <span className="tool-sep" />
              <button
                className={`tool ${lineNumbers ? 'on' : ''}`}
                title="Números de línea"
                aria-pressed={lineNumbers}
                onClick={() => setLineNumbers((v) => !v)}
              >
                <Icon name="lineNumbers" />
              </button>
            </>
          )}
          <div className="spacer" />
          <div className="seg" role="group" aria-label="Modo de vista">
            {(['edit', 'split', 'preview'] as ViewMode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} title={`Cambiar vista${k('cycleView')}`} onClick={() => dispatch({ type: 'viewMode', mode: m })}>
                {m === 'edit' ? 'Editor' : m === 'split' ? 'Dividido' : 'Vista'}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div ref={bodyRef} className={`nv-body mode-${mode}`}>
        {mode !== 'preview' && (
          <div className="pane editor-pane">
            <MarkdownEditor
              key={`${note.id}-${lineNumbers}-${st.highlightActiveLine}`}
              value={note.body}
              onChange={(body) => update({ body })}
              onView={(v) => (viewRef.current = v)}
              lineNumbers={lineNumbers}
              settings={st}
            />
          </div>
        )}
        {mode !== 'edit' && (
          <div className="pane preview-pane">
            <Preview body={note.body} theme={state.theme} settings={st} onToggleTask={(i) => update({ body: toggleTask(note.body, i) })} />
          </div>
        )}
        {showToc && (
          <aside className="toc">
            <div className="toc-title">Índice</div>
            {toc.length === 0 && <div className="side-empty">Sin títulos</div>}
            {toc.map((h, i) => (
              <button key={i} className={`toc-l${h.level}`} style={{ paddingLeft: 10 + (h.level - 1) * 12 }} onClick={() => jumpTo(h.line, i)}>
                {h.text}
              </button>
            ))}
          </aside>
        )}
      </div>
      {st.showFooter && <footer className="nv-foot">
        <span>{note.body.trim() ? note.body.trim().split(/\s+/).length : 0} palabras</span>
        <span>{note.body.length} caracteres</span>
        <span>Editada {timeAgo(note.updatedAt)}</span>
        {(st.slashCommands || st.emojiCompletion) && (
          <span className="foot-hint">
            {st.slashCommands && <><kbd>/</kbd> comandos</>}
            {st.slashCommands && st.emojiCompletion && ' · '}
            {st.emojiCompletion && <><kbd>:</kbd> emojis</>}
          </span>
        )}
        <span className="saved"><Icon name="check" size={12} /> Guardado</span>
      </footer>}
    </main>
  )
}
