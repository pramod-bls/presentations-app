const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDecks: () => ipcRenderer.invoke('get-decks'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openDeck: (url) => ipcRenderer.invoke('open-deck', url),
  goHome: () => ipcRenderer.invoke('go-home'),
});
