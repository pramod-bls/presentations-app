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
 * @property {(deckFolder: string) => Promise<void>} watchDeck
 * @property {() => Promise<void>} unwatchDeck
 * @property {(listener: () => void) => () => void} onDeckChanged — returns unsubscribe
 */

contextBridge.exposeInMainWorld('electronAPI', {
  getDecks: () => ipcRenderer.invoke('get-decks'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  getThumbnail: (deckFolder) => ipcRenderer.invoke('get-thumbnail', deckFolder),
  watchDeck: (deckFolder) => ipcRenderer.invoke('watch-deck', deckFolder),
  unwatchDeck: () => ipcRenderer.invoke('unwatch-deck'),
  onDeckChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on('deck-changed', handler);
    return () => ipcRenderer.removeListener('deck-changed', handler);
  },
});
