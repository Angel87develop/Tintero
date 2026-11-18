// Puente seguro entre la interfaz y el proceso principal
const { contextBridge, ipcRenderer, webFrame } = require('electron')

contextBridge.exposeInMainWorld('tinteroDesktop', {
  platform: process.platform,
  load: () => ipcRenderer.sendSync('tintero:load'),
  save: (json) => ipcRenderer.send('tintero:save', json),
  saveSync: (json) => ipcRenderer.sendSync('tintero:saveSync', json),
  dataPath: () => ipcRenderer.invoke('tintero:dataPath'),
  version: () => ipcRenderer.invoke('tintero:version'),
  openDataDir: () => ipcRenderer.invoke('tintero:openDataDir'),
  setZoom: (factor) => webFrame.setZoomFactor(Number(factor) || 1),
  windowControl: (action) => ipcRenderer.send('tintero:window', action),
})
