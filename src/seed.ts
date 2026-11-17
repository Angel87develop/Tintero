import type { Note, Notebook } from './types'

const now = Date.now()
const h = 3600_000
const d = 24 * h

export const seedNotebooks: Notebook[] = [
  { id: 'inbox', name: 'Bandeja', icon: '📥', parentId: null },
  { id: 'work', name: 'Trabajo', icon: '💼', parentId: null },
  { id: 'projects', name: 'Proyectos', icon: '🚀', parentId: 'work' },
  { id: 'personal', name: 'Personal', icon: '🌿', parentId: null },
]

let n = 0
const mk = (p: Partial<Note> & Pick<Note, 'title' | 'body'>): Note => ({
  id: `seed-${++n}`,
  notebookId: 'inbox',
  status: 'none',
  tags: [],
  pinned: false,
  trashed: false,
  createdAt: now - 10 * d,
  updatedAt: now,
  ...p,
})

export const seedNotes: Note[] = [
  mk({
    title: 'Bienvenido a Tintero',
    notebookId: 'inbox',
    pinned: true,
    updatedAt: now - 5 * 60_000,
    tags: ['guía'],
    body: `Tintero es un espacio limpio para escribir notas técnicas en **Markdown**.

## Atajos útiles

| Atajo | Acción |
| --- | --- |
| \`Ctrl+K\` | Paleta de comandos |
| \`Ctrl+N\` | Nueva nota |
| \`Ctrl+E\` | Cambiar modo editor / dividido / vista previa |
| \`Ctrl+Shift+F\` | Buscar notas |
| \`/\` al inicio de línea | Comandos de inserción |

## Organización

- [x] Crea **cuadernos** (pueden anidarse)
- [x] Asigna un **estado**: activa, en pausa, completada o descartada
- [ ] Etiqueta tus notas para filtrarlas
- [ ] Fija las importantes arriba con 📌

> [!TIP]
> Haz clic en las casillas de la vista previa para marcarlas.

\`\`\`ts filename="hola.ts"
export function saludar(nombre: string) {
  return \`Hola, \${nombre} 👋\`
}
\`\`\`
`,
  }),
  mk({
    title: 'La lista de notas va lenta con 3k notas',
    notebookId: 'work',
    status: 'active',
    tags: ['trabajo', 'bug'],
    updatedAt: now - 2 * h,
    body: `Al desplazar la lista con miles de notas los FPS bajan a ~20.

## Perfilado

\`\`\`
Scripting   2.140 ms
Rendering     680 ms
Painting      210 ms
\`\`\`

Está limitado por scripting, no por pintado.

## Tareas

- [x] Reproducir con base de datos grande
- [x] Grabar perfil de 4 s
- [ ] Memoizar \`NoteListItem\`
- [ ] Virtualizar la lista

\`\`\`tsx filename="src/components/note-list-item.tsx"
export const NoteListItem = memo(function NoteListItem({ note }: Props) {
  return <li>{note.title}</li>
})
\`\`\`
`,
  }),
  mk({
    title: 'Elegir un índice vectorial local',
    notebookId: 'projects',
    status: 'active',
    tags: ['trabajo', 'investigación'],
    updatedAt: now - 1 * d,
    body: `Objetivo: búsqueda semántica sin servidor, totalmente offline.

- [x] Listar candidatos
- [ ] Medir tamaño del índice
- [ ] Medir latencia de consulta
- [ ] Decidir

Criterios: **< 50 MB**, **< 30 ms** por consulta.
`,
  }),
  mk({
    title: 'Cómo publicamos una versión',
    notebookId: 'work',
    status: 'completed',
    tags: ['trabajo'],
    updatedAt: now - 4 * d,
    body: `Lo dejo escrito porque siempre lo redescubro leyendo el CI.

1. Actualizar \`CHANGELOG.md\`
2. \`npm version minor\`
3. \`git push --follow-tags\`
4. Esperar a que el pipeline firme los binarios
5. Publicar el borrador del release

> [!WARNING]
> No publiques un viernes por la tarde.
`,
  }),
  mk({
    title: 'BM25 para ordenar resultados',
    notebookId: 'projects',
    status: 'onHold',
    tags: ['investigación'],
    updatedAt: now - 7 * d,
    body: `Ahora mismo los resultados se ordenan por fecha. BM25 pondera:

- frecuencia del término en el documento
- rareza del término en el corpus
- longitud del documento

\`\`\`python
def idf(N, df):
    return math.log((N - df + 0.5) / (df + 0.5) + 1)
\`\`\`
`,
  }),
  mk({
    title: 'Diagramas y fórmulas',
    notebookId: 'inbox',
    tags: ['guía'],
    updatedAt: now - 30 * 60_000,
    body: `Tintero dibuja diagramas **Mermaid** y fórmulas **KaTeX** en la vista previa.

## Diagrama de flujo

Haz clic en el diagrama para verlo a pantalla completa (zoom con la rueda, arrastra para mover).

\`\`\`mermaid
flowchart LR
  A[Escribir nota] --> B{¿Tiene tareas?}
  B -- Sí --> C[Estado: activa]
  B -- No --> D[Archivar]
  C --> E[Completada]
\`\`\`

## Secuencia

\`\`\`mermaid
sequenceDiagram
  participant U as Usuario
  participant E as Editor
  participant S as Almacenamiento
  U->>E: Escribe
  E->>S: Guardado automático
  S-->>E: OK
\`\`\`

## Fórmulas

En línea: la energía es $E = mc^2$ y la puntuación BM25 usa $\\mathrm{idf}(q_i)$.

En bloque:

$$
\\mathrm{score}(D,Q) = \\sum_{i=1}^{n} \\mathrm{idf}(q_i) \\cdot \\frac{f(q_i,D)\\,(k_1+1)}{f(q_i,D) + k_1\\left(1 - b + b\\,\\frac{|D|}{\\mathrm{avgdl}}\\right)}
$$

Escribe \`/diagrama\` o \`/formula\` al inicio de una línea para insertarlos.
`,
  }),
  mk({
    title: 'Escritorio — brazo para monitor',
    notebookId: 'personal',
    tags: ['personal'],
    updatedAt: now - 5 * d,
    body: `Cambié a un brazo articulado: el portátil queda como segunda pantalla a la altura de los ojos.

- Menos dolor de cuello
- Más espacio en la mesa
`,
  }),
  mk({
    title: 'Idea descartada: sincronizar por FTP',
    notebookId: 'work',
    status: 'dropped',
    tags: ['trabajo'],
    updatedAt: now - 9 * d,
    body: `Demasiado frágil y sin cifrado. Descartado.`,
  }),
]
