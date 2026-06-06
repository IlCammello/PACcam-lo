const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  // Native HTTP — bypasses CORS e Yahoo Finance 403
  fetchNative: (url) => ipcRenderer.invoke('fetch-native', url),
  // File system
  saveBackup: (data) => ipcRenderer.invoke('save-backup', data),
  loadBackup: () => ipcRenderer.invoke('load-backup'),
  autoSave: (data) => ipcRenderer.invoke('auto-save', data),
  autoLoad: () => ipcRenderer.invoke('auto-load'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  isElectron: true,
});
