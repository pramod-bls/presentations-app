# Architecture

This document describes how the app is wired together. For user-facing
instructions see [README.md](README.md).

## Process model

```mermaid
flowchart TB
  subgraph Main["Electron main process (src/main.js)"]
    IPC["IPC handlers<br/>get-decks · get-config<br/>open-folder · get-thumbnail"]
    PROTO["file:// protocol handler<br/>(serves reveal/, plugin/,<br/>generated deck HTML)"]
    THUMB["Thumbnail worker<br/>(offscreen BrowserWindow<br/>+ PNG cache)"]
    CONFIG["Config<br/>(userData/config.json)"]
  end

  subgraph Renderer["Host renderer (src/renderer.js)"]
    HOME["Home grid<br/>welcome · folder bar · cards"]
    VIEWER["Deck viewer overlay<br/>iframe sandbox='allow-scripts'"]
  end

  subgraph DeckIframe["Sandboxed deck iframe (null origin)"]
    TEMPLATE["Generated HTML<br/>(src/deck-template.js)"]
    REVEAL["Reveal.js + plugins"]
    SC["SlideController core<br/>+ optional d3-helpers"]
    DECKJS["deck.js<br/>(user code)"]
  end

  PRELOAD["preload.js<br/>contextBridge"]

  Renderer <-. window.electronAPI .-> PRELOAD
  PRELOAD <-. ipcRenderer.invoke .-> IPC

  Renderer -- loads index.html<br/>via file:// --> PROTO
  DeckIframe -- loads index.html<br/>+ /reveal/* + /plugin/* --> PROTO

  IPC --> CONFIG
  IPC --> THUMB
  THUMB --> PROTO

  TEMPLATE --> REVEAL --> SC --> DECKJS
```

## Component responsibilities

### Main process — [src/main.js](src/main.js)

Single entry point for everything that needs Node.js, file-system access,
or Electron APIs.

- **Config persistence**: one JSON file under `userData`, single key
  (`presentationsFolder`). No schema, no migration.
- **Protocol handler**: replaces Electron's default `file://` handling so
  we can (a) map virtual paths like `/reveal/reveal.js` to the bundled
  assets directory, (b) map `/user-themes/<name>/*` to the user's
  writable theme folder under the active presentations folder,
  (c) synthesize `<deck>/index.html` from `deck.md` on the fly, and
  (d) add `Access-Control-Allow-Origin: *` so null-origin deck iframes
  can load same-folder assets. Path traversal is blocked by
  `resolveWithinBase`.
- **Theme loader**: resolves `theme: <name>` in a deck's front-matter by
  checking the user's `<presentationsFolder>/_themes/<name>/` first,
  then falling back to the bundled `reveal/themes/<name>/`. User themes
  are cache-invalidated when the active folder changes.
- **Thumbnail worker**: on first `get-thumbnail` call, opens an offscreen
  `BrowserWindow` at 1920×1080, loads the deck, polls for
  `Reveal.isReady()`, captures the viewport, resizes to 640px wide, and
  writes a PNG under `userData/thumbnails/`. Cache is invalidated by
  comparing mtimes of `deck.md`, `index.html`, `deck.js`, `deck.css`.
- **IPC**: four handlers — `get-decks`, `get-config`, `open-folder`,
  `get-thumbnail`.

### Preload — [src/preload.js](src/preload.js)

Only the renderer ever talks to the main process, and only through
`window.electronAPI`. `contextIsolation: true` means the renderer's JS
world has no access to `ipcRenderer` directly — this module is the single
trust boundary.

### Host renderer — [src/renderer.js](src/renderer.js)

Plain DOM, no framework. Two states:

1. **Welcome**: no presentations folder configured → show a button.
2. **Grid**: list of cards, each with a thumbnail, title, and click
   handler. Clicking a card mounts a full-window overlay containing
   an `<iframe sandbox="allow-scripts">` loading the deck.

### Deck template — [src/deck-template.js](src/deck-template.js)

Pure function that generates the deck HTML for `deck.md`-only decks.
Called by the protocol handler when a deck's `index.html` is requested
but the file doesn't exist.

### Deck iframe (sandboxed)

Every deck runs in an iframe with `sandbox="allow-scripts"` and no
`allow-same-origin`. This is the core of the untrusted-deck security
model — see the Security section below.

When the active folder is marked **trusted** (File → Trust This Folder),
the sandbox also receives `allow-popups` and `allow-popups-to-escape-sandbox`
so Reveal's built-in speaker-notes window works. Null origin is preserved;
the parent-window / `electronAPI` barriers stay intact.

Inside the iframe, the generated HTML loads:

1. Reveal.js core + plugins (markdown, highlight, notes, zoom, search)
2. SlideController core ([reveal/plugin/slide-controller/index.js](reveal/plugin/slide-controller/index.js))
3. Optional `scripts:` from front-matter (d3, anime, d3-helpers, …)
4. `DeckInit.initialize(...)` with Reveal overrides from front-matter
5. Optional `deck.js` from the deck folder

## IPC surface

| Channel | Payload | Response | Purpose |
|---------|---------|----------|---------|
| `get-decks` | — | `Array<Deck>` | List decks in the active folder. If the folder itself contains `deck.md`/`index.html`, returns just that one deck. |
| `get-config` | — | `{ presentationsFolder, trustedFolder }` | Return persisted config incl. whether the active folder is trusted. |
| `open-folder` | — | `string \| null` | Show native folder picker, persist choice, return path (or null if cancelled). |
| `set-folder-trusted` | `boolean` | `boolean` | Toggle trust for the active folder; returns the new trust state. |
| `get-thumbnail` | `deckFolder: string` | `{ path: string\|null }` | Cached PNG path for a deck, capturing it first if stale. |
| `watch-deck` | `deckFolder: string` | `void` | Start watching a deck folder; fires `deck-changed` events on change (debounced 200ms). |
| `unwatch-deck` | — | `void` | Stop the active watcher. Called when the viewer closes. |
| `deck-changed` | *(main → renderer event)* | — | Fires when a watched deck's files change. Renderer cache-busts the iframe src. |

`Deck` shape: `{ name: string, path: file://…/index.html, folder: string, source: 'html'|'markdown' }`.

## SlideController plugin

See the JSDoc at the top of
[reveal/plugin/slide-controller/index.js](reveal/plugin/slide-controller/index.js)
for the full API. At a glance:

- Core: `registerSlide(id, steps)`, `registerReset(id, fn)`, `registerSlideInit(id, fn)`, `getSlideId()`. Keybindings: Enter advances, R resets.
- d3-helpers (opt-in): `show`, `hide`, `sel`, `loadSVG`, `animatePath`, `animatePathLin`, `animatePathLin2`, `animateImg`, `morphPaths`. Wraps `registerReset` so anything made visible via `show()` is hidden automatically on R.

## Security model

Deck iframes are **untrusted** by default.

| Capability | Allowed? | How |
|------------|----------|-----|
| Execute deck JS | Yes | `allow-scripts` in sandbox |
| Register SlideController animations | Yes | SlideController loads inside the iframe |
| Manipulate the deck's own DOM | Yes | Same-document access |
| Fetch files in the deck folder | Yes | Protocol handler serves them with `ACAO: *` |
| Read `window.parent` / `window.top` | No | Null origin (no `allow-same-origin`) |
| Read `window.electronAPI` | No | Preload only runs in the host renderer |
| Navigate the top window | No | `allow-top-navigation` not set |
| Read files outside the deck folder | No | Protocol handler scopes `/reveal/*` and `/plugin/*` to the app's `reveal/` dir; raw deck-folder paths are served but not above them |

A verification deck lives at `/tmp/presentations-sample/sandbox-test/`
which exercises the four host-facing escapes and logs PASS/FAIL to the
console.

## Packaging

`forge.config.js` has `extraResource: ['reveal']`, so every file under
`reveal/` ships in packaged builds — including `reveal/vendor/d3.min.js`
and `reveal/vendor/anime.min.js`. Decks can reference these paths in
their front-matter `scripts:` list without network access.

`samples/` is for reference content only and is **not** bundled.

## Dev-loop notes

- Edits to `src/renderer.js` hot-reload via Vite HMR (no restart).
- Edits to `src/main.js` or `src/preload.js` trigger a full main-process
  restart via [vite-hot-restart.mjs](vite-hot-restart.mjs), which emits
  `rs\n` into Forge's stdin on each rebuild (works around
  [electron/forge#3380](https://github.com/electron/forge/issues/3380)).
- Edits to files under `reveal/` require reopening the deck (those
  files are served as-is by the protocol handler; there's no watcher).
