import { useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown } from '../markdown'
import { Icon } from './Icons'
import { isDarkTheme, themeKey, type Settings } from '../settings'

const svgCache = new Map<string, string>()
let seq = 0

async function renderMermaid(src: string, theme: string, dark: boolean): Promise<string> {
  const key = `${theme}\u0000${src}`
  const hit = svgCache.get(key)
  if (hit) return hit
  const { default: mermaid } = await import('mermaid')
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: v('--sans'),
    themeVariables: {
      darkMode: dark,
      background: v('--bg'),
      primaryColor: v('--panel'),
      primaryTextColor: v('--fg-strong'),
      primaryBorderColor: v('--accent'),
      secondaryColor: v('--list'),
      tertiaryColor: v('--side'),
      lineColor: v('--muted'),
      edgeLabelBackground: v('--panel'),
      clusterBkg: v('--side'),
      clusterBorder: v('--border'),
      textColor: v('--fg'),
      noteBkgColor: v('--accent-soft'),
      noteTextColor: v('--fg'),
      noteBorderColor: v('--accent'),
    },
  })
  const { svg } = await mermaid.render(`mmd-${++seq}`, src)
  svgCache.set(key, svg)
  return svg
}

export function Preview({
  body,
  theme,
  settings,
  onToggleTask,
}: {
  body: string
  theme: string
  settings: Settings
  onToggleTask: (i: number) => void
}) {
  const html = useMemo(() => renderMarkdown(body), [body])
  const ref = useRef<HTMLDivElement>(null)
  const tkey = themeKey(theme, settings)
  const dark = isDarkTheme(theme, settings)
  const [full, setFull] = useState<string | null>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    let cancelled = false
    const blocks = [...root.querySelectorAll<HTMLElement>('.mermaid-block')]
    for (const fig of blocks) {
      const src = decodeURIComponent(fig.dataset.src ?? '')
      const target = fig.querySelector<HTMLElement>('.mermaid-svg')!
      renderMermaid(src, tkey, dark)
        .then((svg) => {
          if (!cancelled) target.innerHTML = svg
        })
        .catch((e: unknown) => {
          if (cancelled) return
          const msg = e instanceof Error ? e.message : String(e)
          target.innerHTML = ''
          const pre = document.createElement('pre')
          pre.className = 'mermaid-error'
          pre.textContent = `Error en el diagrama:\n${msg}`
          target.appendChild(pre)
        })
    }
    return () => {
      cancelled = true
    }
  }, [html, tkey, dark])

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    if (el instanceof HTMLInputElement && el.classList.contains('task')) {
      e.preventDefault()
      const all = [...e.currentTarget.querySelectorAll('input.task')]
      onToggleTask(all.indexOf(el))
      return
    }
    if (el.matches('[data-copy]')) {
      const code = el.closest('figure')?.querySelector('code')?.textContent ?? ''
      navigator.clipboard?.writeText(code).then(() => {
        el.textContent = '¡Copiado!'
        setTimeout(() => (el.textContent = 'Copiar'), 1200)
      })
      return
    }
    const fig = el.closest<HTMLElement>('.mermaid-block')
    if (fig && (el.matches('[data-mermaid-full]') || el.closest('svg'))) {
      const svg = fig.querySelector('.mermaid-svg svg')
      if (svg) setFull(svg.outerHTML)
      return
    }
    const a = el.closest('a')
    if (a?.href) {
      e.preventDefault()
      window.open(a.href, '_blank', 'noopener')
    }
  }

  return (
    <>
      <div ref={ref} className="preview markdown-body" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      {full && <DiagramViewer svg={full} onClose={() => setFull(null)} />}
    </>
  )
}

/**
 * Mermaid genera el SVG con width="100%" y un max-width en línea. Dentro del visor (un
 * contenedor que se ajusta a su contenido) eso se resolvía a 0×0 y el diagrama salía vacío.
 * Aquí se clona el SVG, se le da un tamaño explícito a partir del viewBox para que quepa en
 * la ventana y se renombran sus ids para no chocar con el diagrama de la vista previa.
 */
function fitSvg(raw: string): string {
  const host = document.createElement('div')
  host.innerHTML = raw
  const svg = host.querySelector('svg')
  if (!svg) return raw
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const w = vb[2] || parseFloat(svg.getAttribute('width') ?? '') || 800
  const h = vb[3] || parseFloat(svg.getAttribute('height') ?? '') || 600
  const fit = Math.min((window.innerWidth * 0.88) / w, (window.innerHeight * 0.78) / h, 3)
  svg.setAttribute('width', String(Math.round(w * fit)))
  svg.setAttribute('height', String(Math.round(h * fit)))
  svg.style.maxWidth = 'none'
  const id = svg.id
  let out = svg.outerHTML
  if (id) out = out.split(id).join(`${id}-full`)
  return out
}

const clampK = (k: number) => Math.min(Math.max(k, 0.2), 8)

function DiagramViewer({ svg, onClose }: { svg: string; onClose: () => void }) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const sized = useMemo(() => fitSvg(svg), [svg])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setView((v) => ({ ...v, k: clampK(v.k * 1.2) }))
      if (e.key === '-') setView((v) => ({ ...v, k: clampK(v.k / 1.2) }))
      if (e.key === '0') setView({ x: 0, y: 0, k: 1 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="diagram-viewer"
      onWheel={(e) => {
        // Zoom hacia el puntero
        const r = e.currentTarget.getBoundingClientRect()
        const cx = e.clientX - r.left - r.width / 2
        const cy = e.clientY - r.top - r.height / 2
        setView((v) => {
          const k = clampK(v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
          const f = k / v.k
          return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }
        })
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.dv-tools')) return
        drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (drag.current) setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }))
      }}
      onPointerUp={() => (drag.current = null)}
      onDoubleClick={(e) => !(e.target as HTMLElement).closest('.dv-tools') && setView({ x: 0, y: 0, k: 1 })}
    >
      <div className="dv-tools">
        <button onClick={() => setView((v) => ({ ...v, k: clampK(v.k / 1.2) }))} title="Alejar (-)"><Icon name="zoomOut" /></button>
        <span>{Math.round(view.k * 100)}%</span>
        <button onClick={() => setView((v) => ({ ...v, k: clampK(v.k * 1.2) }))} title="Acercar (+)"><Icon name="zoomIn" /></button>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })} title="Restablecer (0)"><Icon name="restore" /></button>
        <span className="dv-sep" />
        <button onClick={onClose} title="Cerrar (Esc)"><Icon name="x" /></button>
      </div>
      <div
        className="dv-canvas"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        dangerouslySetInnerHTML={{ __html: sized }}
      />
      <div className="dv-hint">Rueda para zoom · arrastra para mover · doble clic para centrar · Esc para cerrar</div>
    </div>
  )
}
