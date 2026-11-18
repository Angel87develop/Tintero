import type { Dispatch, RefObject } from 'react'
import type { Action } from '../store'
import { excerpt, taskProgress, timeAgo, visibleNotes } from '../store'
import type { SortKey, State } from '../types'
import { STATUS_COLOR, STATUS_LABEL } from '../types'
import { Icon } from './Icons'
import { WindowControls } from './WindowControls'

export function NoteList({
  state,
  dispatch,
  searchRef,
  onSettings,
}: {
  state: State
  dispatch: Dispatch<Action>
  searchRef: RefObject<HTMLInputElement | null>
  onSettings: () => void
}) {
  const notes = visibleNotes(state)
  const f = state.filter
  const title =
    f.kind === 'all'
      ? 'Todas las notas'
      : f.kind === 'notebook'
        ? state.notebooks.find((b) => b.id === f.id)?.name ?? 'Cuaderno'
        : f.kind === 'status'
          ? STATUS_LABEL[f.status]
          : f.kind === 'tag'
            ? `#${f.tag}`
            : 'Papelera'

  return (
    <section className="notelist">
      <header className="nl-head">
        <button className="icon-btn" title="Mostrar/ocultar barra lateral" onClick={() => dispatch({ type: 'toggleSidebar' })}><Icon name="menu" /></button>
        <h2>{title}</h2>
        {/* Sustituye a la fila superior de la barra lateral cuando esta no se ve */}
        <div className="nl-window">
          <WindowControls />
          <button className="icon-btn" title="Configuración" aria-label="Configuración" onClick={onSettings}><Icon name="gear" /></button>
        </div>
        {f.kind === 'trash' ? (
          <button className="btn ghost" disabled={!notes.length} onClick={() => {
            if (!state.settings.confirmDelete || confirm('¿Vaciar la papelera? No se puede deshacer.')) dispatch({ type: 'emptyTrash' })
          }}>Vaciar</button>
        ) : (
          <button className="btn primary" title="Nueva nota (Ctrl+N)" aria-label="Nueva nota" onClick={() => dispatch({ type: 'newNote' })}><Icon name="plus" size={14} /> <span className="nl-new-label">Nota</span></button>
        )}
      </header>
      <div className="nl-tools">
        <label className="search">
        <Icon name="search" size={14} />
        <input
          ref={searchRef}
          placeholder="Buscar…  (#etiqueta)"
          value={state.query}
          onChange={(e) => dispatch({ type: 'query', query: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && dispatch({ type: 'query', query: '' })}
        />
        {state.query && (
          <button className="search-clear" title="Limpiar" onClick={() => dispatch({ type: 'query', query: '' })}><Icon name="x" size={12} /></button>
        )}
        </label>
        <select value={state.sort} onChange={(e) => dispatch({ type: 'sort', sort: e.target.value as SortKey })} title="Ordenar">
          <option value="updatedAt">Modificadas</option>
          <option value="createdAt">Creadas</option>
          <option value="title">Título</option>
        </select>
      </div>
      <ul className="nl-items">
        {notes.length === 0 && <li className="nl-empty">{state.query ? 'Sin resultados' : 'No hay notas aquí'}</li>}
        {notes.map((n) => {
          const p = taskProgress(n.body)
          return (
            <li
              key={n.id}
              className={`nl-item ${state.selectedId === n.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'select', id: n.id })}
            >
              <div className="nl-title">
                {n.pinned && <span className="pin" title="Fijada"><Icon name="pin" size={12} /></span>}
                {n.status !== 'none' && <span className="dot" title={STATUS_LABEL[n.status]} style={{ background: STATUS_COLOR[n.status] }} />}
                <span>{n.title || 'Sin título'}</span>
              </div>
              <div className="nl-meta">
                <span>{timeAgo(n.updatedAt)}</span>
                {p.all > 0 && (
                  <span className="progress" title="Tareas">
                    <span className="bar"><span style={{ width: `${(p.done / p.all) * 100}%` }} /></span>
                    {p.done} de {p.all}
                  </span>
                )}
                {n.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
              </div>
              <div className="nl-excerpt">{excerpt(n.body) || '—'}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
