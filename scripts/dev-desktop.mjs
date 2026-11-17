// Arranca Vite y abre Tintero en Electron con recarga en caliente.
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electron from 'electron'

const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })
await server.listen()
const url = server.resolvedUrls.local[0]
console.log(`Vite listo en ${url} — abriendo Electron…`)
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, TINTERO_DEV_URL: url } })
child.on('exit', async (code) => {
  await server.close()
  process.exit(code ?? 0)
})
