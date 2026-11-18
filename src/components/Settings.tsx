import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { Action } from '../store'
import { uid } from '../store'
import { desktop } from '../desktop'
import type { SortKey, State, ViewMode } from '../types'
import {
  BUILTIN_THEMES,
  SHORTCUTS,
  THEME_TOKENS,
  comboFromEvent,
  currentColor,
  shortcutOf,
  type CustomTheme,
  type EditorFont,
  type Settings as SettingsT,
  type ShortcutId,
  type ThemeToken,
} from '../settings'
import { Icon, type IconName } from './Icons'

type Section = 'appearance' | 'editor' | 'shortcuts' | 'general' | 'about'

const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'appearance', label: 'Apariencia', icon: 'palette' },
  { id: 'editor', label: 'Editor', icon: 'pencil' },
  { id: 'shortcuts', label: 'Atajos de teclado', icon: 'keyboard' },
  { id: 'general', label: 'General y datos', icon: 'sliders' },
  { id: 'about', label: 'Acerca de', icon: 'info' },
]

export function SettingsPanel({
  state,
  dispatch,
  onClose,
  onImport,
  onExport,
}: {
  state: State
  dispatch: Dispatch<Action>
  onClose: () => void
  onImport: () => void
  onExport: () => void
}) {
  const [section, setSection] = useState<Section>('appearance')
  const s = state.settings
  const set = (patch: Partial<SettingsT>) => dispatch({ type: 'settings', patch })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.kb-rec.recording') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="palette-backdrop settings-backdrop" onMouseDown={onClose}>
      <div className="settings" role="dialog" aria-label="Configuración" onMouseDown={(e) => e.stopPropagation()}>
        <nav className="st-nav">
          <div className="st-nav-title">Configuración</div>
          {SECTIONS.map((x) => (
            <button key={x.id} className={`st-nav-item ${section === x.id ? 'on' : ''}`} onClick={() => setSection(x.id)}>
              <Icon name={x.icon} size={15} /> {x.label}
            </button>
          ))}
        </nav>
        <div className="st-main">
          <header className="st-head">
            <h2>{SECTIONS.find((x) => x.id === section)!.label}</h2>
            <button className="icon-btn" title="Cerrar (Esc)" onClick={onClose}><Icon name="x" /></button>
          </header>
          <div className="st-body">
            {section === 'appearance' && <Appearance state={state} dispatch={dispatch} set={set} />}
            {section === 'editor' && <EditorSection s={s} set={set} />}
            {section === 'shortcuts' && <Shortcuts s={s} set={set} />}
            {section === 'general' && <General state={state} dispatch={dispatch} set={set} onImport={onImport} onExport={onExport} />}
            {section === 'about' && <About />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- piezas reutilizables ---------- */

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-label">
        <div>{label}</div>
        {hint && <small>{hint}</small>}
      </div>
      <div className="st-control">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

function Range({ value, min, max, step, unit = '', format, onChange }: {
  value: number; min: number; max: number; step: number; unit?: string; format?: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="range">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{format ? format(value) : `${value}${unit}`}</span>
    </div>
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

/* ---------- Apariencia ---------- */

function Appearance({ state, dispatch, set }: { state: State; dispatch: Dispatch<Action>; set: (p: Partial<SettingsT>) => void }) {
  const s = state.settings
  const custom = s.customThemes.find((t) => t.id === state.theme)
  // Fuerza a releer los colores efectivos tras cambiar de tema
  const [, refresh] = useState(0)
  useEffect(() => { const t = setTimeout(() => refresh((n) => n + 1)); return () => clearTimeout(t) }, [state.theme, custom])

  const saveThemes = (list: CustomTheme[]) => set({ customThemes: list })
  const updateCustom = (patch: Partial<CustomTheme>) =>
    custom && saveThemes(s.customThemes.map((t) => (t.id === custom.id ? { ...t, ...patch } : t)))

  const duplicate = () => {
    const base = custom?.base ?? (state.theme as CustomTheme['base'])
    // Solo se guardan los colores cambiados; el resto se hereda del tema base.
    const colors: CustomTheme['colors'] = { ...custom?.colors }
    const label = custom?.name ?? BUILTIN_THEMES.find((t) => t.id === base)?.label ?? 'Tema'
    const theme: CustomTheme = { id: `custom-${uid()}`, name: `${label} personalizado`, base, colors }
    saveThemes([...s.customThemes, theme])
    dispatch({ type: 'theme', theme: theme.id })
  }

  return (
    <>
      <h3 className="st-h">Tema</h3>
      <div className="theme-grid">
        {BUILTIN_THEMES.map((t) => (
          <ThemeCard key={t.id} name={t.label} sub={t.dark ? 'Oscuro' : 'Claro'} swatch={t.swatch} on={state.theme === t.id}
            onClick={() => dispatch({ type: 'theme', theme: t.id })} />
        ))}
        {s.customThemes.map((t) => {
          const b = BUILTIN_THEMES.find((x) => x.id === t.base)!
          const sw = [t.colors.bg ?? b.swatch[0], t.colors.panel ?? b.swatch[1], t.colors.accent ?? b.swatch[2], t.colors.fg ?? b.swatch[3]]
          return (
            <ThemeCard key={t.id} name={t.name} sub="Personalizado" swatch={sw} on={state.theme === t.id}
              onClick={() => dispatch({ type: 'theme', theme: t.id })} />
          )
        })}
        <button className="theme-card add" onClick={duplicate} title="Crea una copia editable del tema actual">
          <Icon name="plus" size={18} />
          <span>Nuevo tema a partir del actual</span>
        </button>
      </div>

      {custom ? (
        <div className="theme-editor">
          <div className="te-head">
            <input className="te-name" value={custom.name} onChange={(e) => updateCustom({ name: e.target.value })} aria-label="Nombre del tema" />
            <label className="te-base">
              Base
              <select value={custom.base} onChange={(e) => updateCustom({ base: e.target.value as CustomTheme['base'] })}>
                {BUILTIN_THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <button className="btn" onClick={duplicate}>Duplicar</button>
            <button className="btn danger" onClick={() => {
              saveThemes(s.customThemes.filter((t) => t.id !== custom.id))
              dispatch({ type: 'theme', theme: custom.base })
            }}><Icon name="trash" size={14} /> Eliminar</button>
          </div>
          {THEME_TOKENS.map((g) => (
            <div key={g.group} className="te-group">
              <div className="te-group-title">{g.group}</div>
              <div className="te-colors">
                {g.items.map((t) => (
                  <ColorField key={t.key} token={t.key} label={t.label} value={custom.colors[t.key] ?? currentColor(t.key)}
                    onChange={(v) => updateCustom({ colors: { ...custom.colors, [t.key]: v } })}
                    onReset={custom.colors[t.key] ? () => {
                      const { [t.key]: _, ...rest } = custom.colors
                      updateCustom({ colors: rest })
                    } : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="st-note">Los temas incorporados no se pueden modificar. Crea un tema nuevo a partir del actual para cambiar cualquier color.</p>
      )}

      <h3 className="st-h">Tipografía y tamaño</h3>
      <Row label="Tamaño de la interfaz" hint="Barra lateral, lista y menús">
        <Range value={s.uiFontSize} min={12} max={17} step={0.5} unit="px" onChange={(v) => set({ uiFontSize: v })} />
      </Row>
      <Row label="Zoom general" hint="Escala toda la ventana">
        <Range value={s.zoom} min={0.7} max={1.6} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ zoom: v })} />
      </Row>
      <Row label="Tamaño de la vista previa">
        <Range value={s.previewFontSize} min={12} max={22} step={0.5} unit="px" onChange={(v) => set({ previewFontSize: v })} />
      </Row>
    </>
  )
}

function ThemeCard({ name, sub, swatch, on, onClick }: { name: string; sub: string; swatch: string[]; on: boolean; onClick: () => void }) {
  const [bg, panel, accent, fg] = swatch
  return (
    <button className={`theme-card ${on ? 'on' : ''}`} onClick={onClick}>
      <div className="tc-preview" style={{ background: bg }}>
        <div className="tc-side" style={{ background: panel }} />
        <div className="tc-lines">
          <span style={{ background: fg, width: '70%' }} />
          <span style={{ background: fg, width: '50%', opacity: 0.5 }} />
          <span style={{ background: accent, width: '35%' }} />
        </div>
        {on && <div className="tc-check" style={{ background: accent }}><Icon name="check" size={11} /></div>}
      </div>
      <div className="tc-name">{name}</div>
      <div className="tc-sub">{sub}</div>
    </button>
  )
}

function ColorField({ token, label, value, onChange, onReset }: {
  token: ThemeToken; label: string; value: string; onChange: (v: string) => void; onReset?: () => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className="color-field" title={`--${token}`}>
      <span className="cf-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="cf-label">{label}</span>
      <input
        className="cf-hex"
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value)
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value)
        }}
        onBlur={() => setDraft(value)}
      />
      {onReset && <button className="cf-reset" title="Volver al color de la base" onClick={(e) => { e.preventDefault(); onReset() }}><Icon name="restore" size={12} /></button>}
    </label>
  )
}

/* ---------- Editor ---------- */

function EditorSection({ s, set }: { s: SettingsT; set: (p: Partial<SettingsT>) => void }) {
  return (
    <>
      <h3 className="st-h">Texto</h3>
      <Row label="Fuente del editor">
        <Seg<EditorFont> value={s.editorFont} onChange={(v) => set({ editorFont: v })}
          options={[['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['custom', 'Otra…']]} />
      </Row>
      {s.editorFont === 'custom' && (
        <Row label="Nombre de la fuente" hint="Debe estar instalada en el sistema">
          <input className="st-input" placeholder="p. ej. Fira Code" value={s.customFont} onChange={(e) => set({ customFont: e.target.value })} />
        </Row>
      )}
      <Row label="Tamaño del texto">
        <Range value={s.editorFontSize} min={12} max={24} step={0.5} unit="px" onChange={(v) => set({ editorFontSize: v })} />
      </Row>
      <Row label="Interlineado">
        <Range value={s.lineHeight} min={1.3} max={2.2} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set({ lineHeight: v })} />
      </Row>
      <Row label="Ancho máximo del texto" hint="Editor y vista previa">
        <Range value={s.contentWidth} min={560} max={1400} step={20}
          format={(v) => (v >= 1400 ? 'Completo' : `${v}px`)} onChange={(v) => set({ contentWidth: v })} />
      </Row>

      <h3 className="st-h">Comportamiento</h3>
      <Row label="Vista al abrir la app">
        <Seg<ViewMode> value={s.defaultViewMode} onChange={(v) => set({ defaultViewMode: v })}
          options={[['edit', 'Editor'], ['split', 'Dividido'], ['preview', 'Vista']]} />
      </Row>
      <Row label="Números de línea"><Toggle checked={s.lineNumbers} onChange={(v) => set({ lineNumbers: v })} /></Row>
      <Row label="Resaltar la línea actual"><Toggle checked={s.highlightActiveLine} onChange={(v) => set({ highlightActiveLine: v })} /></Row>
      <Row label="Corrector ortográfico"><Toggle checked={s.spellcheck} onChange={(v) => set({ spellcheck: v })} /></Row>
      <Row label="Comandos con /" hint="Menú al escribir / al inicio de una línea"><Toggle checked={s.slashCommands} onChange={(v) => set({ slashCommands: v })} /></Row>
      <Row label="Emojis con :" hint="Sugerencias al escribir :nombre"><Toggle checked={s.emojiCompletion} onChange={(v) => set({ emojiCompletion: v })} /></Row>
      <Row label="Autocompletado de Markdown" hint="Tablas, listas, tareas, formato y bloques de código"><Toggle checked={s.markdownAssist} onChange={(v) => set({ markdownAssist: v })} /></Row>

      <h3 className="st-h">Interfaz de la nota</h3>
      <Row label="Barra de formato"><Toggle checked={s.showToolbar} onChange={(v) => set({ showToolbar: v })} /></Row>
      <Row label="Pie con estadísticas" hint="Palabras, caracteres y guardado"><Toggle checked={s.showFooter} onChange={(v) => set({ showFooter: v })} /></Row>
    </>
  )
}

/* ---------- Atajos ---------- */

function Shortcuts({ s, set }: { s: SettingsT; set: (p: Partial<SettingsT>) => void }) {
  const [recording, setRecording] = useState<ShortcutId | null>(null)
  const [filter, setFilter] = useState('')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of SHORTCUTS) {
      const c = shortcutOf(s, x.id)
      if (c) m.set(c, (m.get(c) ?? 0) + 1)
    }
    return m
  }, [s])

  const assign = (id: ShortcutId, combo: string) => set({ shortcuts: { ...s.shortcuts, [id]: combo } })
  const reset = (id: ShortcutId) => {
    const { [id]: _, ...rest } = s.shortcuts
    set({ shortcuts: rest })
  }
  const groups = [...new Set(SHORTCUTS.map((x) => x.group))]
  const list = SHORTCUTS.filter((x) => !filter || x.label.toLowerCase().includes(filter.toLowerCase()))

  return (
    <>
      <div className="kb-top">
        <label className="search">
          <Icon name="search" size={14} />
          <input placeholder="Filtrar atajos…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <button className="btn" disabled={!Object.keys(s.shortcuts).length} onClick={() => set({ shortcuts: {} })}>
          <Icon name="restore" size={14} /> Restablecer todos
        </button>
      </div>
      <p className="st-note">Haz clic en un atajo y pulsa la nueva combinación. <kbd>Esc</kbd> cancela, <kbd>Retroceso</kbd> lo deja sin atajo.</p>
      {groups.map((g) => {
        const items = list.filter((x) => x.group === g)
        if (!items.length) return null
        return (
          <div key={g}>
            <h3 className="st-h">{g}</h3>
            {items.map((x) => {
              const combo = shortcutOf(s, x.id)
              const clash = !!combo && (counts.get(combo) ?? 0) > 1
              const changed = x.id in s.shortcuts
              return (
                <Row key={x.id} label={x.label} hint={clash ? 'En conflicto con otro atajo' : undefined}>
                  <button
                    className={`kb-rec ${recording === x.id ? 'recording' : ''} ${clash ? 'clash' : ''}`}
                    onClick={() => setRecording(x.id)}
                    onBlur={() => setRecording(null)}
                    onKeyDown={(e) => {
                      if (recording !== x.id) return
                      e.preventDefault()
                      e.stopPropagation()
                      if (e.key === 'Escape') return setRecording(null)
                      if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey) { assign(x.id, ''); return setRecording(null) }
                      const c = comboFromEvent(e)
                      if (!c) return
                      assign(x.id, c)
                      setRecording(null)
                    }}
                  >
                    {recording === x.id ? 'Pulsa una combinación…' : combo ? combo.split(/\+(?!$)/).map((k, i) => <kbd key={i}>{k}</kbd>) : <span className="kb-none">Sin atajo</span>}
                  </button>
                  <button className="icon-btn" title="Restablecer" style={{ visibility: changed ? 'visible' : 'hidden' }} onClick={() => reset(x.id)}>
                    <Icon name="restore" size={14} />
                  </button>
                </Row>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

/* ---------- General ---------- */

function General({ state, dispatch, set, onImport, onExport }: {
  state: State; dispatch: Dispatch<Action>; set: (p: Partial<SettingsT>) => void; onImport: () => void; onExport: () => void
}) {
  const s = state.settings
  return (
    <>
      <h3 className="st-h">Notas</h3>
      <Row label="Orden de la lista">
        <Seg<SortKey> value={state.sort} onChange={(v) => { dispatch({ type: 'sort', sort: v }); set({ defaultSort: v }) }}
          options={[['updatedAt', 'Modificadas'], ['createdAt', 'Creadas'], ['title', 'Título']]} />
      </Row>
      <Row label="Mostrar la barra lateral"><Toggle checked={state.sidebarOpen} onChange={() => dispatch({ type: 'toggleSidebar' })} /></Row>
      <Row label="Confirmar antes de borrar" hint="Al eliminar definitivamente o vaciar la papelera">
        <Toggle checked={s.confirmDelete} onChange={(v) => set({ confirmDelete: v })} />
      </Row>

      <h3 className="st-h">Datos</h3>
      <Row label="Importar archivos Markdown" hint=".md, .markdown o .txt">
        <button className="btn" onClick={onImport}>Importar…</button>
      </Row>
      <Row label="Copia de seguridad" hint={`${state.notes.length} notas · ${state.notebooks.length} cuadernos`}>
        <button className="btn" onClick={onExport}><Icon name="download" size={14} /> Exportar JSON</button>
      </Row>
      {desktop && (
        <Row label="Carpeta de datos" hint="Donde se guardan tus notas y las copias diarias">
          <button className="btn" onClick={() => desktop?.openDataDir()}>Abrir carpeta</button>
        </Row>
      )}

      <h3 className="st-h">Restablecer</h3>
      <Row label="Volver a la configuración original" hint="No borra notas ni temas personalizados">
        <button className="btn danger" onClick={() => {
          if (!s.confirmDelete || confirm('¿Restablecer toda la configuración?')) dispatch({ type: 'resetSettings' })
        }}>Restablecer</button>
      </Row>
    </>
  )
}

/* ---------- Acerca de ---------- */

function About() {
  const [version, setVersion] = useState<string>(__APP_VERSION__)
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    desktop?.version().then(setVersion)
    desktop?.dataPath().then(setPath)
  }, [])
  return (
    <div className="about">
      <div className="empty-mark">
        <svg viewBox="0 0 32 32" width="40" height="40"><path d="M16 3c5 7 9 11 9 17a9 9 0 0 1-18 0c0-6 4-10 9-17z" fill="var(--accent)" /></svg>
      </div>
      <h3>Tintero</h3>
      <p>Versión {version}</p>
      <p className="st-note">Notas Markdown para desarrolladores.</p>
      {path && <p className="st-note">Tus notas se guardan en <code>{path}</code></p>}
      {desktop && (
        <div className="about-keys">
          <span><kbd>F11</kbd> pantalla completa</span>
          <span><kbd>F12</kbd> herramientas de desarrollo</span>
          <span><kbd>F5</kbd> recargar</span>
        </div>
      )}
    </div>
  )
}
