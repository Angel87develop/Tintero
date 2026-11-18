# Tintero

Notas Markdown para desarrolladores: cuadernos anidados, estados, etiquetas, paleta de comandos,
diagramas Mermaid, fórmulas KaTeX y cuatro temas. Funciona en el navegador y como app de escritorio.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Versión web en http://localhost:5178 |
| `npm run desktop` | App de escritorio con recarga en caliente |
| `npm run desktop:start` | App de escritorio con el build de producción |
| `npm run dist:win` | Instalador y versión portable de Windows en `release/` |
| `npm run icon` | Regenera `build/icon.png` |

## Dónde se guardan las notas

- **Escritorio:** `%APPDATA%\Tintero\tintero-notas.json`, con una copia diaria en `copias\`.
  Menú *Archivo → Abrir carpeta de datos*.
- **Web:** almacenamiento local del navegador (`localStorage`).

## Atajos

`Ctrl+K` paleta · `Ctrl+N` nueva nota · `Ctrl+E` editor/dividido/vista · `Ctrl+Shift+F` buscar ·
`Ctrl+\` barra lateral · `/` al inicio de línea para insertar bloques · `:` para emojis.

## Autocompletado de Markdown

- **Tablas:** `Enter` tras el encabezado crea el separador y la primera fila. `Tab` y `Shift+Tab` recorren las celdas.
- **Listas:** `Tab` y `Shift+Tab` anidan elementos y reajustan la numeración. `- [` seguido de espacio crea una tarea.
- **Formato:** `**`, `~~` y `` ` `` se cierran solos, y `*`, `_`, `~`, `` ` `` o `$` envuelven la selección.
- **Bloques:** `Enter` cierra los bloques ` ``` ` y `$$`, con sugerencias de lenguaje y de alertas (`> [!`).
