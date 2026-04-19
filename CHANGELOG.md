# Changelog

All notable changes to this project go here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions use [Semantic Versioning](https://semver.org/).

Bundled Reveal.js version is tracked alongside app versions below.

## [Unreleased]

### Added

- **`TEMPLATE` theme** as an authoring starting point under `reveal/themes/TEMPLATE/`. Exhaustively commented `theme.css`, every-key `theme.json`, placeholder logo, plus a README walking through the workflow. Surfaces via **File → Copy Built-in Theme to My Folder…** alongside `custom-sample`.
- **Reveal built-ins in the theme picker.** **File → Copy Built-in Theme to My Folder…** now offers two categories: **Preset** (the app's `TEMPLATE` / `custom-sample`) and **Reveal.js built-in** (the 12 upstream themes). Reveal themes are generated on the fly from the bundled Sass source into an editable `theme.css` of `--r-*` custom-property overrides — human-readable, not minified, freely tweakable. Each generated folder ships with a minimal `theme.json` + `README.md`. Added `src/scss-to-css.js` — a scoped Sass-to-CSS-custom-properties converter that handles the subset of Sass the Reveal themes actually use (`$var`, `color.scale`, multi-line values, `#{...}` interpolation).
- **Reveal.js Sass sources** bundled at `reveal/vendor/themes/src/*.scss` — unminified upstream sources for the 12 built-in themes plus the shared partials (`settings.scss`, `mixins.scss`, `theme.scss`). Reference material for users authoring custom themes; not loaded at runtime. The update-reveal script now keeps these in sync with the rest of the bundled Reveal on each upgrade.
- **Deck live reload.** While a deck is open in the viewer, the main process watches the deck folder; edits to `deck.md`, `deck.js`, `deck.css`, or anything under `assets/` trigger an automatic reload (debounced 200ms, paced at least 300ms apart). A small "Reloaded" flash appears in the top-right on each reload. Watcher tears down automatically when you return to the home grid.
- **Presenter mode (trusted folders).** New **File → Trust This Folder (Enable Presenter Mode)** menu toggle. Trusted folders relax the deck sandbox with `allow-popups` + `allow-popups-to-escape-sandbox` so Reveal's built-in speaker view (press **S**) and `data-preview-link` overlays work. Trust is persisted per folder path in config. Folder bar shows a "trusted" badge when active. Null origin stays in force — parent-window and `electronAPI` access remain blocked even in trusted mode.
- **Standalone HTML export.** **File → Export Current Deck as Standalone HTML…** produces a self-contained folder (`<dest>/<deckname>/`) with the deck files, generated `index.html`, `reveal/`, `plugin/`, and any referenced theme — all with relative paths. Output runs in any browser, no app required. Handy for sharing decks or archiving.
- **PDF export.** **File → Export Current Deck as PDF…** (<kbd>Cmd/Ctrl</kbd> + <kbd>E</kbd>) renders the active deck via Reveal's `?print-pdf` mode in a hidden window and writes a PDF at the deck's canvas dimensions. Opens the output on success. Requires a deck to be open.
- **Signed release pipeline.** `forge.config.js` now supports macOS codesign + notarization and Windows Authenticode signing via env vars (no-ops when unset). Added the DMG maker, the GitHub publisher, and `electron-updater` for in-app auto-update (packaged builds only). `.github/workflows/release.yml` builds all three platforms on `v*` tag push, signs, and publishes a draft GitHub Release. [RELEASING.md](RELEASING.md) documents the maintainer workflow + one-time cert setup.

## [1.0.0] — 2026-04-19

First usable release. The `package.json` version was set to `1.0.0` at project creation, but the features that make the app actually useful all landed together in this release.

**Bundled Reveal.js:** 6.0.0.

### Added

- **Markdown decks.** Folders with a `deck.md` are auto-rendered — the main process generates the wrapper HTML in memory via a custom file protocol handler; no build step.
- **Front-matter config.** YAML-ish block at the top of `deck.md` supports Reveal config (`transition`, `width`, `autoSlide`, …), theme tokens (`font`, `backgroundColor`, `accentColor`, …), logo/footer, and `scripts:` / `styles:` asset lists. All keys validated — bad values drop silently.
- **Theme presets.** `theme: <name>` resolves in three sources, in order: user `<presentations>/_themes/<name>/`, app-bundled `reveal/themes/<name>/`, Reveal.js built-in `reveal/vendor/themes/<name>.css`. Ships 12 Reveal built-in themes (beige, black, blood, dracula, league, moon, night, serif, simple, sky, solarized, white) plus one custom preset `custom-sample`.
- **File menu → Copy Built-in Theme to My Folder…** Clones a bundled theme into `_themes/` for user editing.
- **File menu → Open User Themes Folder.** Opens `_themes/` in the OS file manager.
- **Logo + footer chrome.** `logo` / `logoPosition` / `logoHeight` / `logoCustomPosition` put an image on every slide. `footer` accepts `false`, a string (right-side only), or `{ left, right }`. Tokens `{current}` / `{total}` interpolate to slide counters.
- **Per-slide `<!-- .slide: data-no-logo -->`** hides the logo on specific slides.
- **Sandboxed deck iframes.** Every deck runs in an `<iframe sandbox="allow-scripts">` overlay — deck JS can't reach the host window, `electronAPI`, or other decks. Null origin.
- **Home screen** renders a grid of deck cards with **cached PNG thumbnails** captured via an offscreen `BrowserWindow`, invalidated by source-file mtime.
- **Dual mode folder selection.** Pick a parent folder of decks *or* a single deck folder directly — the app detects which.
- **SlideController plugin refactor.** Thin core (`registerSlide`, `registerReset`, `registerSlideInit`, `getSlideId`, Enter/R bindings) + optional d3-helpers extension (`show`, `hide`, `sel`, `loadSVG`, `animatePath*`, `animateImg`, `morphPaths`). Auto-hides tracked d3 selections on reset.
- **Bundled vendor libraries.** `d3.min.js` and `anime.min.js` under `reveal/vendor/` for offline use via `scripts:`.
- **User-side Reveal override.** Drop replacement files into `<presentations>/_reveal/` to override the bundled reveal.js on a per-file basis. Unsupported; documented as advanced.
- **Samples.** `samples/starter-deck/` (fully commented scaffold with theme pre-wired) and `samples/legacy-original-deck/` (preserves original-deck animations + asset loaders).
- **Reveal cheat sheet.** [REVEAL-CHEATSHEET.md](REVEAL-CHEATSHEET.md) plus a printable [HTML version](REVEAL-CHEATSHEET.html) with embedded print CSS.
- **User guide.** Task-recipe format in [USER-GUIDE.md](USER-GUIDE.md).
- **Front-matter reference.** Exhaustive key table in [FRONT-MATTER-REFERENCE.md](FRONT-MATTER-REFERENCE.md).
- **Architecture doc.** Process model + Mermaid diagram in [ARCHITECTURE.md](ARCHITECTURE.md).
- **Maintainer tool.** `npm run update-reveal [version]` downloads the `reveal.js` npm tarball and swaps core files, plugins, and built-in themes, preserving our custom plugin. Protects uncommitted work with a git-clean check.

### Security

- Path traversal blocked on `/reveal/*`, `/plugin/*`, and `/user-themes/*` via a `resolveWithinBase` helper.
- `decodeURIComponent` wrapped in try/catch for malformed URLs (400 response).
- Deck iframes have no `allow-same-origin` → null origin; cross-deck and host-reach attacks blocked by the sandbox.
- Theme JSON sanitized through the same validator pipeline as front-matter — themes can't smuggle unknown keys.

### Changed

- Deck opening no longer navigates the main window; a full-window iframe overlay mounts on top of the grid and tears down on "⬅ Home".
- Thumbnails on the home screen switched from eager live iframes to cached PNGs (dramatic memory reduction with many decks).
- SlideController's `getSlideId()` now prefers the `<section>` id, falling back to the first child `<div>` id (fixes markdown-generated decks whose sections have ids directly).
- Front-matter parser extended with block/inline YAML lists (`scripts:`, `styles:`) and block maps (`footer:`).
- `slideNumber` auto-disabled when the chrome footer is rendering, unless explicitly set in front-matter.

### Developer experience

- Main-process auto-restart on source changes. Custom Vite plugin ([vite-hot-restart.mjs](vite-hot-restart.mjs)) works around [electron/forge#3380](https://github.com/electron/forge/issues/3380) by emitting `rs\n` into Forge's stdin after each rebuild.
- Shared `DECK_WEB_PREFERENCES` constant unifies security settings across main window and thumbnail capture window.

## [0.1.0] — 2026-03-17

Initial scaffolding commits. Electron Forge + Vite setup, bundled Reveal.js 6.0.0, SlideController plugin, and a placeholder deck initializer. No deck rendering pipeline yet.

[Unreleased]: https://github.com/YOUR_ORG/presentations-app/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_ORG/presentations-app/releases/tag/v1.0.0
[0.1.0]: https://github.com/YOUR_ORG/presentations-app/releases/tag/v0.1.0
