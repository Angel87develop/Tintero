import { useEffect, useReducer, useRef } from 'react'
import { desktop } from './desktop'
import type { Filter, Note, Notebook, SortKey, State, Status, ViewMode } from './types'
import { seedNotebooks, seedNotes } from './seed'
import { DEFAULT_SETTINGS, type Settings } from './settings'

const KEY = 'tintero:v1'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export type Action =
  | { type: 'select'; id: string | null }
  | { type: 'filter'; filter: Filter }
  | { type: 'query'; query: string }
  | { type: 'sort'; sort: SortKey }
  | { type: 'viewMode'; mode: ViewMode }
  | { type: 'theme'; theme: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'resetSettings' }
  | { type: 'toggleSidebar' }
  | { type: 'newNote'; notebookId?: string; title?: string; body?: string }
  | { type: 'updateNote'; id: string; patch: Partial<Note> }
  | { type: 'trashNote'; id: string }
  | { type: 'restoreNote'; id: string }
  | { type: 'deleteForever'; id: string }
  | { type: 'emptyTrash' }
  | { type: 'addNotebook'; name: string; parentId: string | null }
  | { type: 'renameNotebook'; id: string; name: string; icon?: string }
  | { type: 'deleteNotebook'; id: string }

function readRaw(): string | null {
  if (desktop) return desktop.load()
  return localStorage.getItem(KEY)
}

function writeRaw(json: string, sync = false) {
  if (desktop) return sync ? desktop.saveSync(json) : desktop.save(json)
  localStorage.setItem(KEY, json)
}

function initial(): State {
  try {
    const raw = readRaw()
    if (raw) {
      const s = JSON.parse(raw) as State
      if (Array.isArray(s.notes) && Array.isArray(s.notebooks)) {
        const settings = { ...DEFAULT_SETTINGS, ...s.settings }
        return { ...s, query: '', settings, viewMode: settings.defaultViewMode, sort: settings.defaultSort }
      }
    }
  } catch {
    /* sin almacenamiento: usamos los datos de ejemplo */
  }
  return {
    notes: seedNotes,
    notebooks: seedNotebooks,
    filter: { kind: 'all' },
    selectedId: seedNotes[0].id,
    query: '',
    sort: 'updatedAt',
    viewMode: 'split',
    theme: 'tinta',
    sidebarOpen: true,
    settings: DEFAULT_SETTINGS,
  }
}

function descendants(notebooks: Notebook[], id: string): string[] {
  const kids = notebooks.filter((b) => b.parentId === id).map((b) => b.id)
  return [id, ...kids.flatMap((k) => descendants(notebooks, k))]
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'select':
      return { ...s, selectedId: a.id }
    case 'filter':
      return { ...s, filter: a.filter }
    case 'query':
      return { ...s, query: a.query }
    case 'sort':
      return { ...s, sort: a.sort }
    case 'viewMode':
      return { ...s, viewMode: a.mode }
    case 'theme':
      return { ...s, theme: a.theme }
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } }
    case 'resetSettings':
      return { ...s, settings: { ...DEFAULT_SETTINGS, customThemes: s.settings.customThemes } }
    case 'toggleSidebar':
      return { ...s, sidebarOpen: !s.sidebarOpen }
    case 'newNote': {
      const nb =
        a.notebookId ?? (s.filter.kind === 'notebook' ? s.filter.id : s.notebooks[0]?.id ?? 'inbox')
      const t = Date.now()
      const note: Note = {
        id: uid(),
        title: a.title ?? '',
        body: a.body ?? '',
        notebookId: nb,
        status: s.filter.kind === 'status' ? s.filter.status : 'none',
        tags: s.filter.kind === 'tag' ? [s.filter.tag] : [],
        pinned: false,
        trashed: false,
        createdAt: t,
        updatedAt: t,
      }
      const filter = s.filter.kind === 'trash' ? ({ kind: 'all' } as Filter) : s.filter
      return { ...s, notes: [note, ...s.notes], selectedId: note.id, filter, query: '' }
    }
    case 'updateNote':
      return {
        ...s,
        notes: s.notes.map((n) => (n.id === a.id ? { ...n, ...a.patch, updatedAt: Date.now() } : n)),
      }
    case 'trashNote':
      return {
        ...s,
        notes: s.notes.map((n) => (n.id === a.id ? { ...n, trashed: true, pinned: false } : n)),
      }
    case 'restoreNote':
      return { ...s, notes: s.notes.map((n) => (n.id === a.id ? { ...n, trashed: false } : n)) }
    case 'deleteForever':
      return {
        ...s,
        notes: s.notes.filter((n) => n.id !== a.id),
        selectedId: s.selectedId === a.id ? null : s.selectedId,
      }
    case 'emptyTrash':
      return { ...s, notes: s.notes.filter((n) => !n.trashed) }
    case 'addNotebook': {
      const nb: Notebook = { id: uid(), name: a.name, icon: '📒', parentId: a.parentId }
      return { ...s, notebooks: [...s.notebooks, nb], filter: { kind: 'notebook', id: nb.id } }
    }
    case 'renameNotebook':
      return {
        ...s,
        notebooks: s.notebooks.map((b) =>
          b.id === a.id ? { ...b, name: a.name, icon: a.icon ?? b.icon } : b,
        ),
      }
    case 'deleteNotebook': {
      if (s.notebooks.length <= 1) return s
      const gone = new Set(descendants(s.notebooks, a.id))
      const fallback = s.notebooks.find((b) => !gone.has(b.id))!.id
      return {
        ...s,
        notebooks: s.notebooks.filter((b) => !gone.has(b.id)),
        notes: s.notes.map((n) =>
          gone.has(n.notebookId) ? { ...n, notebookId: fallback, trashed: true } : n,
        ),
        filter: { kind: 'all' },
      }
    }
  }
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, undefined, initial)
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        writeRaw(JSON.stringify(state))
      } catch {
        /* cuota llena o almacenamiento bloqueado */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [state])
  // Al cerrar la ventana, guarda de inmediato lo que quede pendiente.
  useEffect(() => {
    const flush = () => {
      try {
        writeRaw(JSON.stringify(latest.current), true)
      } catch {
        /* nada más que hacer al cerrar */
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])
  return [state, dispatch] as const
}

export function visibleNotes(s: State): Note[] {
  const f = s.filter
  let list = s.notes.filter((n) => (f.kind === 'trash' ? n.trashed : !n.trashed))
  if (f.kind === 'notebook') {
    const ids = new Set(descendants(s.notebooks, f.id))
    list = list.filter((n) => ids.has(n.notebookId))
  } else if (f.kind === 'status') list = list.filter((n) => n.status === f.status)
  else if (f.kind === 'tag') list = list.filter((n) => n.tags.includes(f.tag))

  const q = s.query.trim().toLowerCase()
  if (q) {
    const terms = q.split(/\s+/)
    list = list.filter((n) => {
      const hay = `${n.title}\n${n.body}\n${n.tags.join(' ')}`.toLowerCase()
      return terms.every((t) =>
        t.startsWith('#') ? n.tags.some((tag) => tag.toLowerCase() === t.slice(1)) : hay.includes(t),
      )
    })
  }
  const cmp: Record<SortKey, (a: Note, b: Note) => number> = {
    updatedAt: (a, b) => b.updatedAt - a.updatedAt,
    createdAt: (a, b) => b.createdAt - a.createdAt,
    title: (a, b) => (a.title || '').localeCompare(b.title || '', 'es'),
  }
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp[s.sort](a, b))
}

export function countBy(s: State) {
  const live = s.notes.filter((n) => !n.trashed)
  const status: Record<Status, number> = { none: 0, active: 0, onHold: 0, completed: 0, dropped: 0 }
  const tags = new Map<string, number>()
  const notebooks = new Map<string, number>()
  for (const n of live) {
    status[n.status]++
    for (const t of n.tags) tags.set(t, (tags.get(t) ?? 0) + 1)
    notebooks.set(n.notebookId, (notebooks.get(n.notebookId) ?? 0) + 1)
  }
  return {
    all: live.length,
    trash: s.notes.length - live.length,
    status,
    tags: [...tags.entries()].sort((a, b) => b[1] - a[1]),
    notebooks,
  }
}

export function taskProgress(body: string) {
  const all = body.match(/^\s*[-*+] \[[ xX]\]/gm)?.length ?? 0
  const done = body.match(/^\s*[-*+] \[[xX]\]/gm)?.length ?? 0
  return { all, done }
}

export function toggleTask(body: string, index: number): string {
  let i = -1
  return body.replace(/^(\s*[-*+] \[)([ xX])(\])/gm, (m, a, c, b) => {
    i++
    return i === index ? `${a}${c === ' ' ? 'x' : ' '}${b}` : m
  })
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export function timeAgo(t: number) {
  const s = (t - Date.now()) / 1000
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ]
  let v = s
  for (const [k, unit] of steps) {
    if (Math.abs(v) < k) return rtf.format(Math.round(v), unit)
    v /= k
  }
  return ''
}

export function excerpt(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110)
}
