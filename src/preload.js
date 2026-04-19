/**
 * Preload script — the single trust boundary between the renderer and
 * the main process.
 *
 * Runs in an isolated world alongside the renderer with Node.js + Electron
 * APIs available (but blocked from the renderer's JS world thanks to
 * `contextIsolation: true`). `contextBridge.exposeInMainWorld` is the only
 * way the renderer ever sees anything from here.
 *
 * Whatever is exposed on `window.electronAPI` is the renderer's complete
 * surface area to the main process. Keep it minimal.
 */
const { contextBridge, ipcRenderer } = require('electron');

/**
 * @typedef {Object} ElectronAPI
 * @property {() => Promise<Array<Deck>>} getDecks
 * @property {() => Promise<{ presentationsFolder: string|null }>} getConfig
 * @property {() => Promise<string|null>} openFolder
 * @property {(deckFolder: string) => Promise<{ path: string|null }>} getThumbnail
 */

contextBridge.exposeInMainWorld('electronAPI', {
  getDecks: () => ipcRenderer.invoke('get-decks'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  getThumbnail: (deckFolder) => ipcRenderer.invoke('get-thumbnail', deckFolder),
});
