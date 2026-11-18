import type { Settings } from './settings'

export type Status = 'none' | 'active' | 'onHold' | 'completed' | 'dropped'

export interface Note {
  id: string
  title: string
  body: string
  notebookId: string
  status: Status
  tags: string[]
  pinned: boolean
  trashed: boolean
  createdAt: number
  updatedAt: number
}

export interface Notebook {
  id: string
  name: string
  icon: string
  parentId: string | null
}

export type Filter =
  | { kind: 'all' }
  | { kind: 'notebook'; id: string }
  | { kind: 'status'; status: Status }
  | { kind: 'tag'; tag: string }
  | { kind: 'trash' }

export type SortKey = 'updatedAt' | 'createdAt' | 'title'
export type ViewMode = 'edit' | 'split' | 'preview'
export type ThemeId = 'tinta' | 'papel' | 'fiordo' | 'bosque'

export interface State {
  notes: Note[]
  notebooks: Notebook[]
  filter: Filter
  selectedId: string | null
  query: string
  sort: SortKey
  viewMode: ViewMode
  /** Id de un tema incorporado (ThemeId) o de un tema personalizado */
  theme: string
  sidebarOpen: boolean
  settings: Settings
}

export const STATUS_LABEL: Record<Status, string> = {
  none: 'Sin estado',
  active: 'Activa',
  onHold: 'En pausa',
  completed: 'Completada',
  dropped: 'Descartada',
}

export const STATUS_COLOR: Record<Status, string> = {
  none: 'var(--muted)',
  active: '#6f9060',
  onHold: '#bd8a2f',
  completed: '#5f86a3',
  dropped: '#b0604f',
}

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'tinta', label: 'Tinta (oscuro)' },
  { id: 'papel', label: 'Papel (claro)' },
  { id: 'fiordo', label: 'Fiordo (azul frío)' },
  { id: 'bosque', label: 'Bosque (verde)' },
]
