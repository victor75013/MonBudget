import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  market: {
    isConfigured: () => ipcRenderer.invoke('market:is-configured'),
    saveKey: (key) => ipcRenderer.invoke('market:save-key', key),
    search: (query) => ipcRenderer.invoke('market:search', query),
    history: (instrument) => ipcRenderer.invoke('market:history', instrument)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
