const { contextBridge, ipcRenderer } = require('electron')

// Expose uniquement une API minimale et explicite au renderer (jamais
// nodeIntegration direct), conformement aux bonnes pratiques de securite Electron.
contextBridge.exposeInMainWorld('electronAPI', {
  getEstablishmentConfig: () => ipcRenderer.invoke('get-establishment-config'),
  isOnline: () => navigator.onLine,
  onNetworkChange: (callback) => {
    window.addEventListener('online', () => callback(true))
    window.addEventListener('offline', () => callback(false))
  },
})
