# User Guide — How do I…?

Task-oriented recipes for common things you'll want to do. See [FRONT-MATTER-REFERENCE.md](FRONT-MATTER-REFERENCE.md) for the exhaustive key list, and [README.md](README.md) for conceptual docs.

---

## Get started

### …create my first deck?

```bash
cp -r samples/starter-deck ~/presentations/my-first-deck
```

Then launch the app, pick `~/presentations` via **File → Open Presentations Folder…**, and click the `My First Deck` card.

Edit `~/presentations/my-first-deck/deck.md` to change the slide content; save and reload the deck viewer to see changes.

### …open just a single deck folder?

Instead of a parent folder containing multiple decks, select a single deck folder directly. The app detects `deck.md` or `index.html` at the top level and shows the one deck.

### …know which files a deck can contain?

```
my-deck/
├── deck.md        # required — slide content + front-matter
├── deck.js        # optional — per-slide JavaScript
├── deck.css       # optional — custom CSS (loaded last, wins)
├── assets/        # optional — images, videos, SVGs
```

---

## Styling

### …change the theme?

```yaml
---
theme: black     # any Reveal.js built-in: beige, black, blood, dracula,
                 # league, moon, night, serif, simple, sky, solarized, white
---
```

### …create my own theme?

Menu: **File → Copy Built-in Theme to My Folder…** — this now offers two categories:

- **Preset** — the app's curated starting points (`TEMPLATE`, `custom-sample`). Pick **`TEMPLATE`** for a blank slate, **`custom-sample`** for a pre-populated reference.
- **Reveal.js built-in** — the 12 upstream Reveal themes (black, beige, dracula, …), **generated from their unminified Sass source** into an editable `theme.css` of `--r-*` CSS custom-property overrides. Pick whichever matches the look you want and tweak from there.

The app copies it to `<presentations-folder>/_themes/TEMPLATE/` and opens the folder. Rename the folder to your brand name (e.g. `my-brand`), edit `theme.json`, swap `logo.svg` for your own, and uncomment sections of `theme.css` as you need them.

Reference from a deck:

```yaml
---
theme: my-brand
---
```

Look for `reveal/themes/TEMPLATE/README.md` inside the cloned folder — it walks through the workflow in detail.

Alternative: pick **`custom-sample`** instead of `TEMPLATE` — it's a pre-populated reference theme (Inter font, navy/cyan) so you can see what a complete theme looks like before editing.

### …change just the accent color?

```yaml
---
theme: black
accentColor: "#f59e0b"
---
```

Front-matter always wins over the theme, so this keeps `black` but recolors the progress bar and controls.

### …use a specific font?

```yaml
---
# Bare name → Google Fonts auto-loaded
font: "Inter"

# Or a full CSS stack
font: '"Inter", system-ui, sans-serif'

# Or a local CSS file
font: "/reveal/vendor/my-brand-font.css"
---
```

### …make slides 1920×1080 instead of 960×700?

```yaml
---
width: 1920
height: 1080
---
```

The content scales to the viewport — this just sets the aspect ratio / native resolution you're authoring against.

---

## Logo and footer

### …put a logo on every slide?

```yaml
---
logo: "assets/my-logo.svg"
logoPosition: "bottom-right"   # or top-left, top-right, top-center,
                               # bottom-left, bottom-center
logoHeight: 60                 # px at virtual canvas resolution
---
```

### …hide the logo on one specific slide?

```markdown
<!-- .slide: data-no-logo -->
## Fullscreen image slide

![](huge-diagram.png)
```

### …put a custom footer on every slide?

```yaml
---
# Simple: just the right side
footer: "Pramod Butte · ACME 2026"

# Or full control
footer:
  left: "Internal — Do Not Distribute"
  right: "Slide {current}/{total}"

# Or turn it off entirely
footer: false
---
```

### …show the slide counter somewhere other than the footer?

Disable the chrome footer and use Reveal's built-in slide number:

```yaml
---
footer: false
slideNumber: "c/t"     # "1/12" in the default position (bottom-right)
# Other values: "c" (just 1), "h/v" (horizontal/vertical), "h.v"
---
```

---

## Slide content

### …separate slides in markdown?

```markdown
# Slide 1
---
# Slide 2 (horizontal)
--
## Slide 2.a (vertical sub-slide under Slide 2)
```

`---` on its own line = next horizontal slide. `--` = vertical sub-slide.

### …add speaker notes?

```markdown
# My Slide

Visible content.

Note:
These are speaker notes. Press S to open the speaker view.
```

### …give a slide an ID I can target from `deck.js`?

```markdown
<!-- .slide: id="intro" -->
# Intro

Some content.
```

Then in `deck.js`:

```js
SlideController.registerSlide('intro', [
  () => { /* first Enter press */ },
  () => { /* second Enter press */ },
]);
```

### …add a background image to one slide?

```markdown
<!-- .slide: data-background-image="assets/photo.jpg" data-background-size="cover" -->
# Title slide
```

### …embed a video?

```markdown
<video data-src="assets/demo.mp4" controls></video>

<!-- Or auto-play when the slide is shown -->
<video data-autoplay data-src="assets/demo.mp4"></video>
```

`data-src` lazy-loads — the video only fetches when the slide is near.

### …reveal bullet points one at a time?

```markdown
- First point <!-- .element: class="fragment" -->
- Second point <!-- .element: class="fragment" -->
- Third point <!-- .element: class="fragment fade-up" -->
```

Each press of space/arrow shows the next one.

---

## Interactivity

### …register custom animations for a slide?

In the deck's `deck.js`:

```js
SlideController.registerSlide('my-slide-id', [
  function () {
    document.getElementById('chart').classList.add('visible');
  },
  function () {
    document.querySelector('#conclusion').classList.add('highlight');
  },
]);

SlideController.registerReset('my-slide-id', function () {
  document.getElementById('chart').classList.remove('visible');
  document.querySelector('#conclusion').classList.remove('highlight');
});
```

Press **Enter** on that slide to advance a step, **R** to reset.

### …use d3 in a deck?

```yaml
---
scripts:
  - /reveal/vendor/d3.min.js
  - /plugin/slide-controller/d3-helpers.js
---
```

Then in `deck.js`:

```js
SlideController.registerSlide('chart', [
  function () {
    d3.select('#circle')
      .transition().duration(800)
      .attr('cx', 500);
  },
]);
```

`d3.min.js` and `anime.min.js` are bundled under `reveal/vendor/` — available offline.

### …listen to Reveal events?

```js
// In deck.js
Reveal.on('slidechanged', (event) => {
  console.log('now on slide', event.indexh + 1);
});

Reveal.on('fragmentshown', (event) => {
  console.log('fragment shown:', event.fragment);
});
```

Full event list in [REVEAL-CHEATSHEET.md](REVEAL-CHEATSHEET.md).

### …use Reveal's speaker notes view?

Speaker view opens a separate window showing the current slide, next slide, speaker notes, and a timer. Press **S** on the deck.

By default the app runs decks in a strict sandbox that blocks Reveal's popup, so you'll need to enable presenter mode first:

1. **File → Trust This Folder (Enable Presenter Mode)** — toggle it on.
2. A "trusted" badge appears in the folder bar.
3. Open any deck, press **S**.

What trust grants: the deck iframe can open popups (speaker window, `data-preview-link` overlays). What stays blocked even in trusted mode: host window access, `electronAPI`, cross-deck communication (all enforced by null origin).

Only mark folders trusted when you authored the decks (or trust whoever did). Toggle off again to return to strict sandbox.

### …add a custom keyboard shortcut?

```js
// In deck.js
Reveal.addKeyBinding(
  { keyCode: 77, key: 'M', description: 'Toggle map' },
  () => toggleMap()
);
```

---

## Advanced

### …load an external CSS file per deck?

```yaml
---
styles:
  - https://fonts.googleapis.com/css2?family=Playfair+Display
  - /user-themes/my-brand/extras.css
---
```

Or just create `deck.css` in the deck folder — it's auto-loaded last.

### …share a brand across many decks?

Put fonts, colors, logo, and footer defaults in a theme at `<presentations>/_themes/my-brand/theme.json`. Every deck that includes `theme: my-brand` picks them up automatically.

See [README.md](README.md#themes-presets) for the full theme-authoring walkthrough.

### …use a newer Reveal.js than the app ships with?

Drop the replacement files into `<presentations>/_reveal/`:

```
<presentations>/
├── _reveal/
│   └── reveal.js          # overrides the bundled reveal.js
│
└── my-deck/
    └── deck.md
```

Unsupported — see the "Advanced: user-side Reveal override" section in the README.

### …see my changes to a deck without closing and reopening?

**Already automatic.** While a deck is open in the viewer, the app watches its folder for changes. Save `deck.md`, `deck.js`, `deck.css`, or anything under `assets/`, and the deck reloads within ~200ms — you'll see a small "Reloaded" flash in the top-right.

Caveats:
- The deck restarts from slide 1 after reload (sandbox can't read the inner hash).
- Bursts of saves are debounced — you won't see ten reloads if your editor flushes in chunks.

### …export a deck as a PDF?

Open the deck, then **File → Export Current Deck as PDF…** (<kbd>Cmd/Ctrl</kbd> + <kbd>E</kbd>). Save location is up to you; the app opens the PDF when it's ready.

Under the hood: the deck renders in a hidden window with Reveal's `?print-pdf` mode, which unfolds all slides. Each slide becomes one PDF page sized to match the deck's canvas (`width` / `height` from front-matter, defaults to 1920×1080).

Set `pdfSeparateFragments: true` in front-matter (default) to get one page per fragment reveal, or `false` to collapse fragments onto a single page per slide.

### …make a deck run without the app (standalone HTML)?

Open the deck, then **File → Export Current Deck as Standalone HTML…**. Pick a destination folder; the app creates `<dest>/<deckname>/` with a complete, self-contained copy:

```
my-deck/
├── index.html          # generated with relative paths
├── deck.md             # your source, preserved
├── deck.js / deck.css  # if present
├── assets/             # your assets
├── reveal/             # copy of the app's reveal.js + CSS
├── plugin/             # copy of the plugins + slide-controller
└── themes/<name>/      # theme copied if your deck uses one
```

You can zip this folder, host it on a web server, or just double-click the `index.html` — it works in any browser, no app required. The app opens the exported folder in Finder/Explorer on success.

Caveats:
- External CDN references in `scripts:` / `styles:` still require internet to load at runtime.
- The **Reveal built-in speaker-notes window** (`S` key) only works when served via HTTP, not via `file://` — host the exported folder with any static server (e.g. `python -m http.server`) if you need speaker view.

---

## Troubleshooting

### My deck shows blank / no content

Open DevTools on the deck viewer (**View → Toggle DevTools**). Likely causes:

- **`Reveal is not defined`** — the bundled reveal.js didn't load. Check the Network tab for failed `/reveal/reveal.js` requests. If you have a `_reveal/` override folder, try removing it.
- **Markdown not rendering** — check that your front-matter opens and closes with `---` on their own lines, with no leading spaces.

### Keyboard shortcuts don't work until I click

Known, mostly fixed — the deck template auto-focuses its window on load. If it still happens, click once anywhere on the slide to give it focus. File an issue with your OS/Electron version if it's persistent.

### My `deck.js` fires before Reveal is ready

Wrap the setup in the `ready` event:

```js
function whenReady(fn) {
  if (Reveal.isReady && Reveal.isReady()) fn();
  else Reveal.on('ready', fn);
}

whenReady(() => {
  // Reveal is fully initialized here
});
```

### Fonts load from Google Fonts but I need offline

Download the font's CSS + woff2 files, drop them into the deck folder, reference by path:

```yaml
---
font: "/reveal/vendor/my-font.css"
---
```

Or put them under `<presentations>/_reveal/vendor/` to share across decks.

### Thumbnail on the home screen is stale

Thumbnails are cached and re-captured when any deck file's mtime changes. Touch the deck file:

```bash
touch ~/presentations/my-deck/deck.md
```

Or delete the cache at `~/Library/Application Support/Presentations/thumbnails/` (macOS) to force re-capture on next home-screen view.

### I edited `theme.json` but nothing changed

Themes are cached for the app's lifetime. Quit and relaunch the app. If that's too annoying, do all theme experimentation via front-matter first, then migrate to `theme.json` once settled.

### A deck from last year doesn't work anymore

Reveal.js has been stable across versions, so this is rare. If it happens:

1. Check DevTools for the specific error.
2. Drop the old version's `reveal.js` into `<presentations>/_reveal/reveal.js` as a temporary override.
3. File an issue with the error + version so the app's shared layer can be updated.

---

## Quick command reference

Inside the app (global shortcuts):

| Keys | Action |
|---|---|
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>O</kbd> | Open Presentations Folder |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> | Return home |

Inside a deck (Reveal shortcuts — plus ours):

| Keys | Action |
|---|---|
| <kbd>Space</kbd> / <kbd>→</kbd> | Next slide |
| <kbd>←</kbd> | Previous slide |
| <kbd>Enter</kbd> | Advance SlideController step |
| <kbd>R</kbd> | Reset SlideController state |
| <kbd>S</kbd> | Speaker notes window |
| <kbd>F</kbd> | Fullscreen |
| <kbd>Esc</kbd> / <kbd>O</kbd> | Overview mode |
| <kbd>B</kbd> / <kbd>.</kbd> | Pause / blackout |
| <kbd>?</kbd> | Built-in help overlay |

Full keyboard reference in [REVEAL-CHEATSHEET.md](REVEAL-CHEATSHEET.md).
