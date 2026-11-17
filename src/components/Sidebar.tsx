import { askText } from '../ask'
import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../store'
import { countBy } from '../store'
import type { Filter, Notebook, State, Status } from '../types'
import { STATUS_COLOR, STATUS_LABEL } from '../types'
import { Icon } from './Icons'
import { shortcutOf } from '../settings'

const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b)

export function Sidebar({ state, dispatch, onPalette, onSettings }: { state: State; dispatch: Dispatch<Action>; onPalette: () => void; onSettings: () => void }) {
  const c = countBy(state)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)

  const item = (f: Filter, icon: React.ReactNode, label: string, count?: number, extra?: React.ReactNode) => (
    <button
      className={`side-item ${same(state.filter, f) ? 'active' : ''}`}
      onClick={() => dispatch({ type: 'filter', filter: f })}
    >
      <span className="side-icon">{icon}</span>
      <span className="side-label">{label}</span>
      {extra}
      {count !== undefined && count > 0 && <span className="side-count">{count}</span>}
    </button>
  )

  const renderTree = (parentId: string | null, depth: number): React.ReactNode =>
    state.notebooks
      .filter((b) => b.parentId === parentId)
      .map((b) => {
        const kids = state.notebooks.some((k) => k.parentId === b.id)
        const f: Filter = { kind: 'notebook', id: b.id }
        return (
          <div key={b.id}>
            <div
              className={`side-item nb ${same(state.filter, f) ? 'active' : ''}`}
              style={{ paddingLeft: 10 + depth * 14 }}
              onClick={() => dispatch({ type: 'filter', filter: f })}
              onDoubleClick={() => setEditing(b.id)}
            >
              <span
                className="caret"
                onClick={(e) => {
                  e.stopPropagation()
                  setCollapsed((s) => ({ ...s, [b.id]: !s[b.id] }))
                }}
              >
                {kids && <svg viewBox="0 0 10 10" width="10" height="10" className={collapsed[b.id] ? '' : 'open'}><path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              <span className="side-icon">{b.icon}</span>
              {editing === b.id ? (
                <NotebookRename nb={b} onDone={(name, icon) => {
                  if (name) dispatch({ type: 'renameNotebook', id: b.id, name, icon })
                  setEditing(null)
                }} />
              ) : (
                <span className="side-label">{b.name}</span>
              )}
              <span className="nb-actions">
                <span title="Subcuaderno" onClick={(e) => {
                  e.stopPropagation()
                  askText('Nombre del subcuaderno').then((name) => {
                    if (name) dispatch({ type: 'addNotebook', name: name, parentId: b.id })
                  })
                }}><Icon name="plus" size={13} /></span>
                <span title="Renombrar" onClick={(e) => { e.stopPropagation(); setEditing(b.id) }}><svg className="ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg></span>
                <span title="Eliminar" onClick={(e) => {
                  e.stopPropagation()
                  if (!state.settings.confirmDelete || confirm(`¿Eliminar "${b.name}"? Sus notas irán a la papelera.`))
                    dispatch({ type: 'deleteNotebook', id: b.id })
                }}><Icon name="trash" size={13} /></span>
              </span>
              {!!c.notebooks.get(b.id) && <span className="side-count">{c.notebooks.get(b.id)}</span>}
            </div>
            {!collapsed[b.id] && renderTree(b.id, depth + 1)}
          </div>
        )
      })

  return (
    <aside className="sidebar">
      <div className="brand">
        <svg viewBox="0 0 32 32" width="20" height="20"><path d="M16 3c5 7 9 11 9 17a9 9 0 0 1-18 0c0-6 4-10 9-17z" fill="var(--accent)" /></svg>
        <span>Tintero</span>
        <button className="icon-btn brand-gear" title="Configuración" aria-label="Configuración" onClick={onSettings}>
          <Icon name="gear" />
        </button>
      </div>
      <button className="palette-trigger" onClick={onPalette} title="Paleta de comandos">
        <Icon name="search" size={14} />
        <span>Buscar o ejecutar…</span>
        {shortcutOf(state.settings, 'palette') && <kbd>{shortcutOf(state.settings, 'palette').replace(/\+/g, ' ')}</kbd>}
      </button>
      <nav className="side-scroll">
        {item({ kind: 'all' }, <Icon name="notes" size={15} />, 'Todas las notas', c.all)}

        <div className="side-heading">
          Cuadernos
          <button className="icon-btn" title="Nuevo cuaderno" onClick={() => {
            askText('Nombre del cuaderno').then((name) => {
              if (name) dispatch({ type: 'addNotebook', name: name, parentId: null })
            })
          }}><Icon name="plus" size={14} /></button>
        </div>
        {renderTree(null, 0)}

        <div className="side-heading">Estado</div>
        {(['active', 'onHold', 'completed', 'dropped'] as Status[]).map((s) => (
          <div key={s}>{item({ kind: 'status', status: s }, <span className="dot" style={{ background: STATUS_COLOR[s] }} />, STATUS_LABEL[s], c.status[s])}</div>
        ))}

        <div className="side-heading">Etiquetas</div>
        {c.tags.length === 0 && <div className="side-empty">Sin etiquetas</div>}
        {c.tags.map(([t, n]) => (
          <div key={t}>{item({ kind: 'tag', tag: t }, <span className="tag-hash">#</span>, t, n)}</div>
        ))}

        <div className="side-sep" />
        {item({ kind: 'trash' }, <Icon name="trash" size={15} />, 'Papelera', c.trash)}
      </nav>
    </aside>
  )
}

function NotebookRename({ nb, onDone }: { nb: Notebook; onDone: (name: string, icon: string) => void }) {
  const [v, setV] = useState(`${nb.icon} ${nb.name}`)
  const commit = () => {
    const m = v.trim().match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u)
    onDone((m ? m[2] : v).trim(), m ? m[1] : nb.icon)
  }
  return (
    <input
      className="nb-rename"
      autoFocus
      value={v}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onDone('', nb.icon)
      }}
    />
  )
}
