import { desktop } from '../desktop'

const CONTROLS = [
  { action: 'close', label: 'Cerrar', glyph: 'M3 3l4 4M7 3L3 7' },
  { action: 'minimize', label: 'Minimizar', glyph: 'M2.5 5h5' },
  { action: 'maximize', label: 'Maximizar', glyph: 'M5 2.5v5M2.5 5h5' },
] as const

/** Cerrar, minimizar y maximizar. Solo existen en escritorio: en el navegador no hay ventana que controlar. */
export function WindowControls() {
  if (!desktop) return null
  return (
    <div className="win-controls">
      {CONTROLS.map((c) => (
        <button key={c.action} className={`win-dot ${c.action}`} title={c.label} aria-label={c.label} onClick={() => desktop?.windowControl(c.action)}>
          <span>
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d={c.glyph} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </span>
        </button>
      ))}
    </div>
  )
}
