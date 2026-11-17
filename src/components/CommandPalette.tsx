import { useEffect, useMemo, useRef, useState } from 'react'

export interface Command {
  id: string
  group: string
  label: string
  hint?: string
  run: () => void
}

function score(text: string, q: string): number {
  if (!q) return 1
  const t = text.toLowerCase()
  let ti = 0
  let s = 0
  let streak = 0
  for (const ch of q.toLowerCase()) {
    const i = t.indexOf(ch, ti)
    if (i < 0) return 0
    streak = i === ti ? streak + 1 : 0
    s += 1 + streak * 2 + (i === 0 || t[i - 1] === ' ' ? 3 : 0)
    ti = i + 1
  }
  return s
}

const PREFIXES: Record<string, string> = { '>': 'Comandos', b: 'Cuadernos', t: 'Etiquetas', n: 'Notas' }

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const m = q.match(/^([>btn])\s(.*)$/) ?? (q.startsWith('>') ? ['', '>', q.slice(1)] : null)
    const group = m ? PREFIXES[m[1]] : null
    const query = m ? m[2] : q
    return commands
      .filter((c) => !group || c.group === group)
      .map((c) => ({ c, s: score(c.label, query.trim()) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => x.c)
  }, [q, commands])

  useEffect(() => setI(0), [q])
  useEffect(() => {
    listRef.current?.children[i]?.scrollIntoView({ block: 'nearest' })
  }, [i])

  const run = (c?: Command) => {
    if (!c) return
    onClose()
    c.run()
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Busca notas, cuadernos, etiquetas…   (> comandos · b cuadernos · t etiquetas)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(v + 1, results.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)) }
            if (e.key === 'Enter') run(results[i])
          }}
        />
        <ul ref={listRef}>
          {results.length === 0 && <li className="empty">Sin coincidencias</li>}
          {results.map((c, k) => (
            <li key={c.id} className={k === i ? 'on' : ''} onMouseEnter={() => setI(k)} onClick={() => run(c)}>
              <span className="pg">{c.group}</span>
              <span className="pl">{c.label}</span>
              {c.hint && <kbd>{c.hint}</kbd>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
