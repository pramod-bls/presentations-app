# Presentations App

A universal [Reveal.js](https://revealjs.com/) presentation viewer built with Electron. Point it at a folder of presentations and browse, open, and present them all from one place.

**Other docs:**

- [USER-GUIDE.md](USER-GUIDE.md) — task-oriented "how do I…?" recipes for common needs.
- [FRONT-MATTER-REFERENCE.md](FRONT-MATTER-REFERENCE.md) — exhaustive table of every `deck.md` front-matter key.
- [REVEAL-CHEATSHEET.md](REVEAL-CHEATSHEET.md) — every Reveal.js data attribute, class, and content flag. Printable HTML version: [REVEAL-CHEATSHEET.html](REVEAL-CHEATSHEET.html) (**File → Print → Save as PDF**).
- [ARCHITECTURE.md](ARCHITECTURE.md) — process model, protocol handler, SlideController API, and security boundaries.
- [CHANGELOG.md](CHANGELOG.md) — release notes.
- [RELEASING.md](RELEASING.md) — maintainer guide for cutting signed releases.

## Architecture

The app bundles and serves several shared layers so presentations don't ship their own copies:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Reveal.js** | `reveal/` + `reveal/plugin/` | Core slide engine and plugins (Markdown, Highlight, Notes, Zoom, Search) |
| **DeckInit** | `reveal/deck-init.js` | Shared initializer — sensible defaults, auto-detects loaded plugins |
| **SlideController** | `reveal/plugin/slide-controller/index.js` | Step-based slide animations controlled by Enter (advance) and R (reset) |
| **D3 helpers (opt-in)** | `reveal/plugin/slide-controller/d3-helpers.js` | SVG/animation helpers on top of SlideController. Load via `scripts:` front-matter. |
| **Custom theme presets** | `reveal/themes/<name>/theme.json` (+ optional `theme.css`, logo) | Named bundles of fonts, colors, logo, and footer defaults. Activate with `theme:` front-matter. |
| **Reveal built-in themes** | `reveal/vendor/themes/<name>.css` | Stock Reveal.js theme CSS (beige, black, blood, dracula, league, moon, night, serif, simple, sky, solarized, white). Activate with `theme: <name>`. |
| **Vendor libraries** | `reveal/vendor/d3.min.js`, `reveal/vendor/anime.min.js` | Bundled copies of d3 and anime.js. Reference from `scripts:` as `/reveal/vendor/d3.min.js`. |

All of `reveal/` is included in packaged app builds (see `forge.config.js` → `extraResource`), so decks can rely on these paths without network access.

When a deck folder contains `deck.md`, the app generates the wrapper HTML in memory — no build step, no on-disk artifacts. Folders with their own `index.html` are served as-is.

## Presentation folder layout

You can point the app at either a **parent folder of decks** or a **single deck folder** — it detects which on open.

**Parent folder of decks** (multi-deck grid):

```
presentations/
├── intro-deck/
│   ├── deck.md          # required — slide content (with optional front-matter)
│   ├── deck.js          # optional — custom JavaScript for this deck
│   ├── deck.css         # optional — custom styles for this deck
│   └── assets/          # optional — images, videos, SVGs
├── legacy-talk/
│   └── index.html       # legacy — full custom HTML is still supported
```

Only subfolders that contain **either** `deck.md` **or** `index.html` appear on the home screen.

**Single deck folder** (one card, open directly):

```
my-talk/
├── deck.md
├── deck.js
└── assets/
```

When the selected folder itself contains `deck.md` or `index.html`, the home screen shows just that one deck.

### `deck.md`

Standard Reveal.js Markdown. Horizontal slides are separated by `---` on its own line; vertical slides by `--`.

```markdown
---
title: Intro Deck
transition: fade
progress: true
---

# First Slide

Some content.

---

<!-- .slide: id="animated" -->
## Second Slide

Content here. The HTML comment above sets the slide's DOM id,
which `deck.js` uses to hook animations.
```

**Front-matter** (YAML-ish) is optional. Only allowlisted keys are honored — arbitrary keys are silently dropped, and values that fail validation are also dropped so a typo can't break the deck.

**Reveal.js config**: `title`, `theme`, `transition`, `transitionSpeed`, `backgroundTransition`, `controls`, `progress`, `slideNumber`, `center`, `hash`, `history`, `autoSlide`, `autoSlideStoppable`, `loop`, `rtl`, `showNotes`, `width`, `height`, `margin`, `pdfMaxPagesPerSlide`, `pdfSeparateFragments`.

**Theme**: `theme` (preset name), `font`, `monospaceFont`, `backgroundColor`, `textColor`, `headingColor`, `linkColor`, `accentColor`, `highlightTheme`.

**Chrome (logo + footer)**: `logo`, `logoPosition`, `logoHeight`, `logoCustomPosition`, `footer`.

**Asset lists**: `scripts` and `styles` (YAML block list or inline list).

Example:

```markdown
---
title: Brand Deck
transition: fade
font: "Inter"
backgroundColor: "#0a0a0a"
textColor: "#e8e8e8"
headingColor: "#ffffff"
accentColor: "#42affa"
width: 1920
height: 1080
scripts:
  - /reveal/vendor/d3.min.js
  - /plugin/slide-controller/d3-helpers.js
---
```

**Theme details:**

- Colors accept hex (`#0a0a0a`), `rgb()`/`rgba()`, `hsl()`/`hsla()`, and named colors.
- `font`/`monospaceFont` can be:
  - A bare name (`"Inter"`) — pulled from Google Fonts automatically.
  - A URL (`https://...` or `/reveal/vendor/my-font.css`) — emitted as a `<link>`.
  - A quoted stack (`'"Inter", sans-serif'`) — used as-is, no auto-load.
- `highlightTheme` looks up `/plugin/highlight/<name>.css`. Only `monokai` ships by default — add more by dropping highlight.js theme CSS files into `reveal/plugin/highlight/`.

**Asset lists (`scripts:` and `styles:`)** are loaded before `deck.js` so it can use them. URLs can be absolute (CDNs) or app-served paths (`/reveal/...`, `/plugin/...`).

**Slide IDs** use Reveal's attribute-comment syntax: `<!-- .slide: id="my-slide" -->` on the line before the slide's heading. This sets `<section id="my-slide">` in the DOM, which `deck.js` can then target.

### Themes (presets)

A theme bundles fonts, colors, a logo, and footer defaults so decks can share a look. A theme folder contains:

```
<name>/
├── theme.json      # metadata: fonts, colors, logo path, footer defaults
├── theme.css       # optional extra CSS the theme wants to apply
└── logo.svg        # (or .png) — path referenced from theme.json
```

Activate a theme with `theme: <name>` in front-matter:

```markdown
---
title: My Deck
theme: custom-sample
# Any key here overrides the theme's default (last writer wins):
accentColor: "#f59e0b"
---
```

#### Where themes live

Themes are looked up in three places, in order:

1. **User themes**: `<your-presentations-folder>/_themes/<name>/` — lives with your decks, writable, survives app updates.
2. **Bundled presets**: `reveal/themes/<name>/` inside the app bundle — the custom theme presets that ship with this app (currently `custom-sample`).
3. **Reveal.js built-in themes**: `reveal/vendor/themes/<name>.css` — the stock Reveal.js theme CSS files (see below).

#### Reveal.js built-in themes

These theme names work out of the box because the upstream CSS is vendored into the app (all MIT-licensed from [hakimel/reveal.js](https://github.com/hakimel/reveal.js/tree/master/dist/theme)):

| Name | Feel |
|------|------|
| `beige` | Light, warm, serif body |
| `black` | Dark, default Reveal look, Source Sans Pro |
| `blood` | Dark red + black, dramatic |
| `dracula` | Dark, purple accents |
| `league` | Dark slate, sans-serif |
| `moon` | Dark teal, serif |
| `night` | Near-black, bright orange accents |
| `serif` | Light, warm serif |
| `simple` | Light, clean sans-serif |
| `sky` | Light blue, sans-serif |
| `solarized` | Solarized light palette |
| `white` | Light, default Reveal light look |

```markdown
---
title: Quick Deck
theme: dracula       # uses Reveal's built-in dracula.css
---
```

Reveal built-in themes have no metadata — they're CSS only. Any `font`, `accentColor`, `logo`, or `footer` front-matter keys still apply on top of them.

The app ships `custom-sample` as a starting point. To create your own:

- **File → Copy Built-in Theme to My Folder…** clones a bundled theme into your `_themes/` folder and opens it in Finder/Explorer.
- **File → Open User Themes Folder** opens `_themes/` directly so you can create a theme from scratch or edit an existing one.

Rename the cloned folder to whatever name you want (`my-brand`, `conference-2026`, etc.), edit `theme.json`, and reference it with `theme: my-brand` in a deck.

`theme.json` accepts the same keys allowed in front-matter (the theme/chrome/color/font set). Everything else lives in `theme.css` or the deck's own `deck.css`. Edit `theme.json` and restart the app to see changes (themes are cached for the app's lifetime).

### Logo

```markdown
---
logo: "assets/my-logo.svg"     # relative to deck folder, or a URL
logoPosition: "bottom-right"    # top-left | top-right | top-center
                                # bottom-left | bottom-right | bottom-center
logoHeight: 64                  # pixels at the virtual canvas resolution
logoCustomPosition: "top: 32px; right: 64px;"  # optional override
---
```

The logo is rendered in a fixed layer over every slide. To hide the logo on a specific slide, add `<!-- .slide: data-no-logo -->` before that slide's content.

### Footer

Default: logo-style left side (from the theme) plus a page counter on the right.

Three override shapes, all accepted:

```markdown
---
footer: "Pramod · 2026"        # string → replaces right side only
---
```

```markdown
---
footer:
  left: "ACME Corp"             # full per-side control
  right: "Slide {current}/{total}"
---
```

```markdown
---
footer: false                   # hide the footer entirely
---
```

Tokens `{current}` and `{total}` are interpolated at runtime on every slide change.

### Starting a new deck

The fastest path: copy `samples/starter-deck/` into your presentations folder. It's a fully commented deck scaffold showing every front-matter knob, with the `custom-sample` theme pre-wired.

```bash
cp -r samples/starter-deck ~/presentations/my-talk
```

Open the app, pick your presentations folder, and edit `my-talk/deck.md`.

### `deck.js`

Sibling file to `deck.md`. Runs inside the sandboxed iframe after Reveal is ready. Use it to register per-slide step animations:

```javascript
SlideController.registerSlide('animated', [
  function () {
    // First Enter press on this slide
    document.getElementById('animated').classList.add('revealed');
  },
  function () {
    // Second Enter press
    document.querySelector('#animated .chart').classList.add('show');
  },
]);

SlideController.registerReset('animated', function () {
  document.getElementById('animated').classList.remove('revealed');
});
```

### `deck.css`

Optional. Loaded after `reveal.css`. Use it for per-deck theming.

## Security model

Every deck — whether it ships as `deck.md` or `index.html` — runs inside a sandboxed `<iframe sandbox="allow-scripts">` (no `allow-same-origin`). That means:

- The deck can execute its own JavaScript and register SlideController animations.
- The deck **cannot** reach the host window, `window.parent`, `electronAPI`, or other decks.
- The deck has a null origin, so cross-deck fetches are blocked.
- Same-folder assets (e.g. `assets/photo.png`) are served by the app's protocol handler.

Treat decks you download or receive from others the same way you'd treat any untrusted webpage.

## In-presentation controls

| Key | Action |
|-----|--------|
| Space / → | Next slide |
| ← / Shift+Space | Previous slide |
| Enter | Advance SlideController step |
| R | Reset current slide's SlideController state |
| S | Open speaker notes |
| Esc / O | Overview mode |
| F | Fullscreen |

## Home-screen navigation

- Click a card to open the deck in a full-window overlay.
- Click **⬅ Home** (top-left) inside the viewer to return to the grid.
- **Cmd/Ctrl + O** — pick a new presentations folder.
- **Cmd/Ctrl + Shift + H** — reload the home page.

## Sample decks

The `samples/` folder contains reference decks you can copy into your presentations folder:

- `samples/starter-deck/` — **start here.** Fully commented `deck.md` showing every front-matter knob, with the `custom-sample` theme pre-wired.
- `samples/legacy-original-deck/` — the animations and asset-loading logic that used to be baked into the SlideController plugin. Bring your own SVG assets (see the comment block at the top of its `deck.js`).

## Development

```
npm install
npm start
```

The app uses Electron Forge + Vite. Main-process code is in `src/main.js`; the home-screen renderer is `src/renderer.js`; the deck template generator is `src/deck-template.js`.

### Advanced: user-side Reveal override (unsupported)

If a power user needs to try a newer Reveal.js than the one the app ships with, they can drop replacement files into `<presentations-folder>/_reveal/`. The app checks there first for any `/reveal/*` or `/plugin/*` request before falling back to the bundled copy.

```
<your-presentations-folder>/
├── _reveal/                  # optional overrides (advanced)
│   ├── reveal.js             # replaces the bundled reveal.js
│   ├── reveal.css            # replaces the bundled reveal.css
│   └── plugin/
│       └── markdown.js       # replaces the bundled markdown plugin
├── my-deck/
│   └── deck.md
...
```

Drop in only the files you want to override — missing files fall through to the bundled copy, so you can replace `reveal.js` alone without needing to copy every plugin too.

**This is unsupported.** The app's shared layers (`deck-init.js`, `SlideController`, `deck-template.js`) assume the Reveal version we ship. A newer Reveal may break initialization, keybindings, or the generated HTML structure. If your decks stop working, delete `_reveal/` to restore the bundled version.

To check what version you're running, open a deck and look at `window.Reveal.VERSION` in DevTools.

### Upgrading bundled Reveal.js (maintainers only)

The `reveal/` folder is bundled into every packaged build, so end users never need internet access or npm — they get whatever Reveal version ships with the app they install.

To upgrade Reveal between releases:

```bash
# Install latest from npm
npm run update-reveal

# Install a specific version
npm run update-reveal 6.0.1

# Dry-run to preview changes
node scripts/update-reveal.mjs --dry-run
```

The script:

- Downloads the `reveal.js` npm tarball.
- Overwrites `reveal/reveal.js`, `reveal/reveal.css`, `reveal/reset.css`, the bundled plugins under `reveal/plugin/`, and the built-in theme CSS under `reveal/vendor/themes/`.
- **Never touches** our custom `reveal/plugin/slide-controller/`, `reveal/deck-init.js`, `reveal/themes/`, or `reveal/vendor/d3.min.js` / `anime.min.js`.
- Refuses to run if `reveal/` has uncommitted changes (use `--force` to override).

After the script runs, review the diff, smoke-test a few decks, then commit and cut a new app release (`npm run make`).
