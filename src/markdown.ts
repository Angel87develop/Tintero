import { Marked, type TokenizerAndRendererExtension } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'
import { iconHtml } from './components/Icons'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ALERTS: Record<string, string> = {
  NOTE: 'Nota',
  TIP: 'Consejo',
  IMPORTANT: 'Importante',
  WARNING: 'Atención',
  CAUTION: 'Precaución',
}

const tex = (src: string, displayMode: boolean) => {
  try {
    return katex.renderToString(src, { displayMode, throwOnError: false, output: 'htmlAndMathml' })
  } catch (e) {
    return `<span class="math-error">${esc(String(e))}</span>`
  }
}

const mathExtensions: TokenizerAndRendererExtension[] = [
  {
    name: 'mathBlock',
    level: 'block',
    start: (src) => src.match(/^\$\$/m)?.index,
    tokenizer(src) {
      const m = src.match(/^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/)
      if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() }
    },
    renderer: (t) => `<div class="math-block">${tex(t.text, true)}</div>`,
  },
  {
    name: 'mathInline',
    level: 'inline',
    start: (src) => src.indexOf('$'),
    tokenizer(src) {
      const m = src.match(/^\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/)
      if (m) return { type: 'mathInline', raw: m[0], text: m[1] }
    },
    renderer: (t) => tex(t.text, false),
  },
]

const marked = new Marked({
  gfm: true,
  breaks: false,
  extensions: mathExtensions,
  renderer: {
    code({ text, lang }) {
      const info = (lang ?? '').trim()
      const language = info.match(/^\S*/)?.[0] ?? ''
      if (language === 'mermaid') {
        return `<figure class="mermaid-block" data-src="${esc(encodeURIComponent(text))}"><div class="mermaid-tools"><button data-mermaid-full title="Ampliar diagrama">${iconHtml('expand', 14)}</button></div><div class="mermaid-svg"><pre class="mermaid-loading">Dibujando diagrama…</pre></div></figure>`
      }
      if (language === 'math' || language === 'latex' || language === 'katex') {
        return `<div class="math-block">${tex(text, true)}</div>`
      }
      const filename = info.match(/filename="([^"]+)"/)?.[1]
      const startLine = Number(info.match(/line=(\d+)/)?.[1] ?? 1)
      let html: string
      if (language && hljs.getLanguage(language)) {
        html = hljs.highlight(text, { language, ignoreIllegals: true }).value
      } else {
        html = esc(text)
      }
      const lines = html.split('\n')
      const gutter = lines.map((_, i) => `<span>${startLine + i}</span>`).join('')
      const head =
        filename || language
          ? `<div class="code-head"><span class="code-file">${esc(filename ?? '')}</span><span class="code-lang">${esc(language)}</span><button class="code-copy" data-copy>Copiar</button></div>`
          : `<div class="code-head bare"><button class="code-copy" data-copy>Copiar</button></div>`
      return `<figure class="code-block">${head}<div class="code-body"><div class="code-gutter" aria-hidden="true">${gutter}</div><pre><code class="hljs">${lines.join('\n')}</code></pre></div></figure>`
    },
    checkbox({ checked }) {
      return `<input type="checkbox" class="task" ${checked ? 'checked' : ''}> `
    },
    blockquote({ tokens }) {
      const inner = this.parser.parse(tokens)
      const m = inner.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/)
      if (m) {
        const kind = m[1]
        const rest = '<p>' + inner.slice(m[0].length)
        return `<div class="alert alert-${kind.toLowerCase()}"><div class="alert-title">${ALERTS[kind]}</div>${rest}</div>`
      }
      return `<blockquote>${inner}</blockquote>`
    },
  },
})

export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-copy', 'data-mermaid-full', 'target'] })
}

export function headings(src: string) {
  const out: { level: number; text: string; line: number }[] = []
  let inCode = false
  src.split('\n').forEach((l, i) => {
    if (/^```/.test(l)) inCode = !inCode
    const m = !inCode && l.match(/^(#{1,6})\s+(.+)/)
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i })
  })
  return out
}
