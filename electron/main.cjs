// Proceso principal de Tintero (Electron)
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DEV_URL = process.env.TINTERO_DEV_URL
const dataDir = () => app.getPath('userData')
const dataFile = () => path.join(dataDir(), 'tintero-notas.json')
const windowFile = () => path.join(dataDir(), 'ventana.json')

/** Escritura atómica: primero a un temporal y luego se renombra, para no corromper el archivo. */
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, text, 'utf8')
  fs.renameSync(tmp, file)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// ---------- persistencia ----------
let lastSaved = null
ipcMain.on('tintero:load', (e) => {
  try {
    e.returnValue = fs.readFileSync(dataFile(), 'utf8')
  } catch {
    e.returnValue = null
  }
})
ipcMain.on('tintero:save', (_e, json) => {
  if (typeof json !== 'string' || json === lastSaved) return
  try {
    // Copia de seguridad diaria antes de sobrescribir
    const backup = path.join(dataDir(), 'copias', `tintero-${new Date().toISOString().slice(0, 10)}.json`)
    if (!fs.existsSync(backup) && fs.existsSync(dataFile())) {
      fs.mkdirSync(path.dirname(backup), { recursive: true })
      fs.copyFileSync(dataFile(), backup)
    }
    writeAtomic(dataFile(), json)
    lastSaved = json
  } catch (err) {
    console.error('No se pudo guardar:', err)
  }
})
ipcMain.on('tintero:saveSync', (e, json) => {
  try {
    if (typeof json === 'string' && json !== lastSaved) writeAtomic(dataFile(), json)
    lastSaved = json
  } catch (err) {
    console.error('No se pudo guardar:', err)
  }
  e.returnValue = true
})
ipcMain.handle('tintero:dataPath', () => dataFile())

// ---------- ventana ----------
function createWindow() {
  const saved = readJson(windowFile()) ?? {}
  const win = new BrowserWindow({
    width: saved.width ?? 1360,
    height: saved.height ?? 860,
    x: saved.x,
    y: saved.y,
    minWidth: 760,
    minHeight: 480,
    title: 'Tintero',
    // Sin barra de título nativa: los controles de ventana viven junto a la rueda de engranaje.
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#1b1916',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })
  if (saved.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())

  // Los enlaces externos se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file:')
    if (!allowed) {
      e.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })

  const saveBounds = () => {
    try {
      writeAtomic(windowFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }))
    } catch {
      /* no es crítico */
    }
  }
  win.on('close', saveBounds)

  windowShortcuts(win)
  // Sin barra "Archivo / Edición / Ver / Ayuda": la configuración vive en la rueda de engranaje.
  if (process.platform !== 'darwin') win.removeMenu()

  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  return win
}

// ---------- acciones que antes estaban en el menú ----------
// La app ya no tiene barra de menú: todo se configura desde la rueda de engranaje.
ipcMain.handle('tintero:version', () => app.getVersion())
ipcMain.handle('tintero:openDataDir', () => shell.openPath(dataDir()))

ipcMain.on('tintero:window', (e, action) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  if (action === 'close') win.close()
  else if (action === 'minimize') win.minimize()
  else if (action === 'maximize') {
    if (win.isFullScreen()) win.setFullScreen(false)
    else if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
})

/** Atajos de ventana que siguen funcionando sin menú (herramientas de desarrollo, recarga, pantalla completa). */
function windowShortcuts(win) {
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    const k = input.key.toLowerCase()
    if (input.key === 'F12' || (ctrl && input.shift && k === 'i')) {
      win.webContents.toggleDevTools()
      e.preventDefault()
    } else if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      e.preventDefault()
    } else if (input.key === 'F5' || (ctrl && !input.shift && k === 'r')) {
      win.webContents.reload()
      e.preventDefault()
    }
  })
}

/** En macOS el menú de aplicación es necesario para copiar/pegar; en Windows y Linux se elimina. */
function buildMenu() {
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null)
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]))
}

// Una sola instancia: si se abre otra vez, se enfoca la ventana existente
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) {
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })
  app.whenReady().then(() => {
    app.setAppUserModelId('app.tintero.desktop')
    buildMenu()
    createWindow()
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
  })
  app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
}
