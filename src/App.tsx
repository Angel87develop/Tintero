import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { askText } from './ask'
import { desktop } from './desktop'
import { countBy, useStore, visibleNotes } from './store'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { NoteView } from './components/NoteView'
import { CommandPalette, type Command } from './components/CommandPalette'
import { SettingsPanel } from './components/Settings'
import { STATUS_LABEL, type Status, type ViewMode } from './types'
import { BUILTIN_THEMES, SHORTCUTS, applyAppearance, comboFromEvent, shortcutOf, type ShortcutId } from './settings'

const MODES: ViewMode[] = ['edit', 'split', 'preview']

export default function App() {
  const [state, dispatch] = useStore()
  const [palette, setPalette] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const note = state.notes.find((n) => n.id === state.selectedId) ?? null
  const s = state.settings

  // Tema, colores personalizados y tipografía
  useEffect(() => applyAppearance(state.theme, s), [state.theme, s])

  // Zoom general: nativo en escritorio, CSS en el navegador
  useEffect(() => {
    if (desktop) desktop.setZoom(s.zoom)
    else document.documentElement.style.zoom = String(s.zoom)
  }, [s.zoom])

  // Si la nota seleccionada deja de estar visible, selecciona la primera de la lista.
  const list = visibleNotes(state)
  useEffect(() => {
    if (!list.some((n) => n.id === state.selectedId) && !state.query) {
      dispatch({ type: 'select', id: list[0]?.id ?? null })
    }
  }, [state.filter, state.notes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const setZoom = useCallback(
    (z: number) => dispatch({ type: 'settings', patch: { zoom: Math.round(Math.min(Math.max(z, 0.7), 1.6) * 100) / 100 } }),
    [dispatch],
  )

  // Acciones globales asociadas a atajos configurables
  const actions = useRef<Partial<Record<ShortcutId, () => void>>>({})
  actions.current = {
    palette: () => setPalette((v) => !v),
    settings: () => setSettingsOpen((v) => !v),
    newNote: () => dispatch({ type: 'newNote' }),
    search: () => { searchRef.current?.focus(); searchRef.current?.select() },
    sidebar: () => dispatch({ type: 'toggleSidebar' }),
    cycleView: () => dispatch({ type: 'viewMode', mode: MODES[(MODES.indexOf(state.viewMode) + 1) % 3] }),
    viewEdit: () => dispatch({ type: 'viewMode', mode: 'edit' }),
    viewSplit: () => dispatch({ type: 'viewMode', mode: 'split' }),
    viewPreview: () => dispatch({ type: 'viewMode', mode: 'preview' }),
    zoomIn: () => setZoom(s.zoom + 0.1),
    zoomOut: () => setZoom(s.zoom - 0.1),
    zoomReset: () => setZoom(1),
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !/^F\d+$/.test(e.key)) return
      const combo = comboFromEvent(e)
      if (!combo) return
      const hit = SHORTCUTS.find((x) => x.group !== 'Editor' && shortcutOf(s, x.id) === combo)
      const run = hit && actions.current[hit.id]
      if (run) {
        e.preventDefault()
        run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s])

  const importFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of [...files]) {
      const text = await f.text()
      const m = text.match(/^#\s+(.+)\n+/)
      dispatch({
        type: 'newNote',
        title: m ? m[1].trim() : f.name.replace(/\.(md|markdown|txt)$/i, ''),
        body: m ? text.slice(m[0].length) : text,
      })
    }
  }

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ notes: state.notes, notebooks: state.notebooks }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tintero-copia-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const commands = useMemo<Command[]>(() => {
    const c = countBy(state)
    const key = (id: ShortcutId) => shortcutOf(s, id) || undefined
    const themes = [
      ...BUILTIN_THEMES.map((t) => ({ id: t.id, label: t.label })),
      ...s.customThemes.map((t) => ({ id: t.id, label: t.name })),
    ]
    const cmds: Command[] = [
      { id: 'new', group: 'Comandos', label: 'Nueva nota', hint: key('newNote'), run: () => dispatch({ type: 'newNote' }) },
      { id: 'settings', group: 'Comandos', label: 'Configuración', hint: key('settings'), run: () => setSettingsOpen(true) },
      { id: 'search', group: 'Comandos', label: 'Buscar notas', hint: key('search'), run: () => setTimeout(() => searchRef.current?.focus()) },
      { id: 'mode-edit', group: 'Comandos', label: 'Vista: solo editor', hint: key('viewEdit'), run: () => dispatch({ type: 'viewMode', mode: 'edit' }) },
      { id: 'mode-split', group: 'Comandos', label: 'Vista: dividida', hint: key('viewSplit'), run: () => dispatch({ type: 'viewMode', mode: 'split' }) },
      { id: 'mode-prev', group: 'Comandos', label: 'Vista: solo vista previa', hint: key('viewPreview'), run: () => dispatch({ type: 'viewMode', mode: 'preview' }) },
      { id: 'sidebar', group: 'Comandos', label: 'Mostrar/ocultar barra lateral', hint: key('sidebar'), run: () => dispatch({ type: 'toggleSidebar' }) },
      { id: 'zoom-in', group: 'Comandos', label: 'Acercar', hint: key('zoomIn'), run: () => setZoom(s.zoom + 0.1) },
      { id: 'zoom-out', group: 'Comandos', label: 'Alejar', hint: key('zoomOut'), run: () => setZoom(s.zoom - 0.1) },
      { id: 'zoom-reset', group: 'Comandos', label: 'Tamaño real', hint: key('zoomReset'), run: () => setZoom(1) },
      { id: 'import', group: 'Comandos', label: 'Importar archivos Markdown…', run: () => fileRef.current?.click() },
      { id: 'export', group: 'Comandos', label: 'Exportar copia de seguridad (JSON)', run: exportAll },
      ...(desktop ? [{ id: 'datadir', group: 'Comandos', label: 'Abrir carpeta de datos', run: () => void desktop?.openDataDir() }] : []),
      { id: 'nb-new', group: 'Comandos', label: 'Nuevo cuaderno…', run: () => {
        askText('Nombre del cuaderno').then((name) => {
          if (name) dispatch({ type: 'addNotebook', name: name, parentId: null })
        })
      } },
      { id: 'all', group: 'Comandos', label: 'Ir a: Todas las notas', run: () => dispatch({ type: 'filter', filter: { kind: 'all' } }) },
      { id: 'trash', group: 'Comandos', label: 'Ir a: Papelera', run: () => dispatch({ type: 'filter', filter: { kind: 'trash' } }) },
      ...themes.map((t) => ({ id: `theme-${t.id}`, group: 'Comandos', label: `Tema: ${t.label}`, run: () => dispatch({ type: 'theme', theme: t.id }) })),
      ...(['active', 'onHold', 'completed', 'dropped'] as Status[]).map((st) => ({
        id: `st-${st}`, group: 'Comandos', label: `Filtrar por estado: ${STATUS_LABEL[st]}`, run: () => dispatch({ type: 'filter', filter: { kind: 'status', status: st } }),
      })),
    ]
    if (note && !note.trashed) {
      cmds.push(
        { id: 'pin', group: 'Comandos', label: note.pinned ? 'Desfijar nota' : 'Fijar nota arriba', run: () => dispatch({ type: 'updateNote', id: note.id, patch: { pinned: !note.pinned } }) },
        { id: 'del', group: 'Comandos', label: 'Mover nota a la papelera', run: () => dispatch({ type: 'trashNote', id: note.id }) },
        ...(Object.keys(STATUS_LABEL) as Status[]).map((st) => ({
          id: `set-${st}`, group: 'Comandos', label: `Marcar nota como: ${STATUS_LABEL[st]}`, run: () => dispatch({ type: 'updateNote', id: note.id, patch: { status: st } }),
        })),
      )
    }
    for (const b of state.notebooks) cmds.push({ id: `nb-${b.id}`, group: 'Cuadernos', label: `${b.icon} ${b.name}`, run: () => dispatch({ type: 'filter', filter: { kind: 'notebook', id: b.id } }) })
    for (const [t] of c.tags) cmds.push({ id: `tag-${t}`, group: 'Etiquetas', label: `#${t}`, run: () => dispatch({ type: 'filter', filter: { kind: 'tag', tag: t } }) })
    for (const n of state.notes.filter((x) => !x.trashed)) {
      cmds.push({ id: `note-${n.id}`, group: 'Notas', label: n.title || 'Sin título', run: () => {
        dispatch({ type: 'filter', filter: { kind: 'all' } })
        dispatch({ type: 'select', id: n.id })
      } })
    }
    return cmds
  }, [state, note]) // eslint-disable-line react-hooks/exhaustive-deps

  const openSettings = () => setSettingsOpen(true)

  return (
    <div className={`app ${state.sidebarOpen ? '' : 'no-sidebar'}`}>
      {state.sidebarOpen && <Sidebar state={state} dispatch={dispatch} onPalette={() => setPalette(true)} onSettings={openSettings} />}
      <NoteList state={state} dispatch={dispatch} searchRef={searchRef} onSettings={openSettings} />
      {note ? (
        <NoteView key={note.id} state={state} dispatch={dispatch} note={note} />
      ) : (
        <main className="noteview empty-state">
          <div className="empty-mark">
            <svg viewBox="0 0 32 32" width="40" height="40"><path d="M16 3c5 7 9 11 9 17a9 9 0 0 1-18 0c0-6 4-10 9-17z" fill="var(--accent)" /></svg>
          </div>
          <p>Selecciona una nota o crea una nueva</p>
          <div className="empty-keys">
            {shortcutOf(s, 'newNote') && <span><kbd>{shortcutOf(s, 'newNote')}</kbd> nueva nota</span>}
            {shortcutOf(s, 'palette') && <span><kbd>{shortcutOf(s, 'palette')}</kbd> paleta de comandos</span>}
          </div>
        </main>
      )}
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {settingsOpen && (
        <SettingsPanel
          state={state}
          dispatch={dispatch}
          onClose={() => setSettingsOpen(false)}
          onImport={() => fileRef.current?.click()}
          onExport={exportAll}
        />
      )}
      <input ref={fileRef} type="file" accept=".md,.markdown,.txt" multiple hidden onChange={(e) => { importFiles(e.target.files); e.target.value = '' }} />
    </div>
  )
}
