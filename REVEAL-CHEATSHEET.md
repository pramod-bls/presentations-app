# Reveal.js Cheat Sheet

Quick reference for Reveal.js content flags, data attributes, and classes — plus the extras this app adds.

For a printable version, open **[REVEAL-CHEATSHEET.html](REVEAL-CHEATSHEET.html)** in any browser and choose **File → Print → Save as PDF**.

---

## Slide attributes

Set via `<!-- .slide: data-foo="bar" -->` on the line before the slide content in markdown, or directly on a `<section>` in HTML decks.

### Background
| Attribute | Values | Effect |
|---|---|---|
| `data-background-color` | any CSS color | Solid background |
| `data-background-image` | URL | Image background |
| `data-background-size` | `cover` / `contain` / `100px 200px` | Image sizing |
| `data-background-position` | `center`, `top left`, … | Image position |
| `data-background-repeat` | `no-repeat` / `repeat` | Tile behavior |
| `data-background-opacity` | 0–1 | Dim the background |
| `data-background-video` | URL (comma-separated fallbacks) | Video background |
| `data-background-video-loop` | — | Loop video |
| `data-background-video-muted` | — | Mute video |
| `data-background-iframe` | URL | Webpage as background |
| `data-background-interactive` | — | Allow clicking into the iframe bg |
| `data-background-gradient` | `linear-gradient(...)` | CSS gradient |

### Transitions & timing
| Attribute | Values | Effect |
|---|---|---|
| `data-transition` | `slide`, `fade`, `zoom`, `convex`, `concave`, `none` | Per-slide transition |
| `data-transition-speed` | `default`, `fast`, `slow` | Transition speed |
| `data-background-transition` | `slide`, `fade`, `zoom`, `convex`, `concave`, `none` | How the bg switches |
| `data-autoslide` | ms | Auto-advance this slide after N ms |

### Metadata
| Attribute | Effect |
|---|---|
| `id="…"` | Link to slide via `#/slide-id`; target with `SlideController` |
| `data-state="foo bar"` | Adds classes to `<body>` while this slide is active |
| `data-visibility="hidden"` | Skip in navigation but keep in DOM |
| `data-visibility="uncounted"` | Exclude from slide count |
| `data-no-logo` | **App-specific**: hide this app's chrome logo on this slide |

---

## Fragments (per-element reveals)

Fragments appear one at a time as you press space/arrow within a single slide.

```html
<p class="fragment">Appears on first press</p>
<p class="fragment fade-up">Slide + fade up</p>
<p class="fragment highlight-red">Turns red when triggered</p>
```

| Class | Effect |
|---|---|
| `fade-in` | Default — fade in on trigger |
| `fade-out` | Fade out later (starts visible) |
| `fade-up` / `fade-down` / `fade-left` / `fade-right` | Fade + slide in |
| `fade-in-then-out` | Appear, then disappear |
| `fade-in-then-semi-out` | Appear, then go semi-transparent |
| `grow` / `shrink` | Scale up / down |
| `semi-fade-out` | Fade to partial opacity |
| `strike` | Strike-through |
| `highlight-red` / `highlight-green` / `highlight-blue` | Turn text colored |
| `highlight-current-red/green/blue` | Colored only during its step |
| `current-visible` | Visible only during its step |
| `custom` | Base class for your own CSS transitions |

**Ordering with `data-fragment-index`:**

```html
<p class="fragment" data-fragment-index="2">Second</p>
<p class="fragment" data-fragment-index="1">First</p>
<p class="fragment" data-fragment-index="1">Also first (same index groups together)</p>
```

---

## Media

| Attribute | On | Effect |
|---|---|---|
| `data-src` | `<img>`, `<video>`, `<audio>`, `<iframe>` | Lazy-load — source only fetched when slide is near |
| `data-autoplay` | `<video>`, `<audio>`, `<iframe>` | Auto-play when slide is shown |
| `data-preload` | `<section>` or media | Preload before the slide is reached |
| `data-preview-image` | `<a>` | Click opens image overlay (lightbox) |
| `data-preview-link` | `<a>` or slide | Click opens URL in overlay iframe |
| `data-preview-video` | `<a>` | Click opens video overlay |
| `controls` (plain HTML) | `<video>`, `<audio>` | Show native controls |

**Examples:**

```html
<!-- Lazy-load a big video -->
<video data-src="big.mp4" controls></video>

<!-- Auto-play when shown, pause when leaving -->
<video data-autoplay data-src="demo.mp4"></video>

<!-- Click-to-preview full webpage -->
<a href="https://example.com" data-preview-link>Open example</a>

<!-- Click-to-preview image (lightbox) -->
<a href="big-diagram.png" data-preview-image><img src="thumb.png"></a>
```

---

## Code blocks (highlight.js plugin)

| Attribute | Effect |
|---|---|
| `data-trim` | Trim leading/trailing whitespace |
| `data-noescape` | Don't HTML-escape content |
| `data-line-numbers` | Show line numbers. Values: `"3,8-10"` highlights, `"1,3\|5-7\|8-10"` cycles |
| `data-ln-start-from` | Starting line number |
| `data-language` | Explicit language (overrides class detection) |

```html
<pre><code data-trim data-line-numbers="1,3|5-7">
function hello() {
  console.log('hi');
}
</code></pre>
```

Press space three times: first highlights lines 1 & 3, next highlights 5–7, next removes highlight.

---

## Math (math plugin, MathJax)

```html
<section>
  \[ e = mc^2 \]
  $$ \sum_{i=1}^n i = \frac{n(n+1)}{2} $$
</section>
```

---

## Markdown syntax

```markdown
<!-- Horizontal slide separator -->
---

<!-- Vertical sub-slide separator -->
--

<!-- Slide attribute -->
<!-- .slide: data-background="#ff0000" -->
# Title

<!-- Element attribute (applies to line above) -->
Some text.
<!-- .element: class="fragment" -->

<!-- Speaker notes -->
Regular content here.

Note:
Speaker notes (press S to view presenter window).
```

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| → / ↓ / Space / N | Next slide |
| ← / ↑ / P | Previous slide |
| Home / End | First / last slide |
| B / . | Blackout (pause screen) |
| F | Fullscreen |
| Esc / O | Overview mode |
| S | Speaker notes window |
| ? | Help overlay |
| Alt + click | Zoom in on element |
| **Enter** | *App-specific*: SlideController step advance |
| **R** | *App-specific*: SlideController reset |

**Custom binding from `deck.js`:**

```js
Reveal.addKeyBinding(
  { keyCode: 77, key: 'M', description: 'Show map' },
  () => { /* action */ }
);
```

---

## Events (for `deck.js`)

```js
Reveal.on('ready', (event) => { /* initial load */ });

Reveal.on('slidechanged', (event) => {
  event.currentSlide;   // <section> element
  event.previousSlide;
  event.indexh;         // horizontal index
  event.indexv;         // vertical index
});

Reveal.on('fragmentshown', (event) => event.fragment);
Reveal.on('fragmenthidden', (event) => event.fragment);
Reveal.on('overviewshown',  () => {});
Reveal.on('overviewhidden', () => {});
Reveal.on('paused',         () => {});
Reveal.on('resumed',        () => {});
Reveal.on('autoslidepaused',  () => {});
Reveal.on('autoslideresumed', () => {});
```

---

## Runtime API (most-used)

```js
// Navigation
Reveal.next(); Reveal.prev();
Reveal.up(); Reveal.down(); Reveal.left(); Reveal.right();
Reveal.slide(h, v, f);          // jump to specific slide

// State queries
Reveal.getCurrentSlide();        // <section>
Reveal.getIndices();             // { h, v, f }
Reveal.getSlidePastCount();
Reveal.getTotalSlides();
Reveal.getProgress();            // 0–1
Reveal.isFirstSlide();
Reveal.isLastSlide();
Reveal.isPaused();
Reveal.isOverview();
Reveal.isAutoSliding();

// UI
Reveal.togglePause();
Reveal.toggleOverview();

// Reconfigure at runtime
Reveal.configure({ transition: 'fade' });
```

---

## `Reveal.initialize(...)` options reference

Keys relevant when writing a deck's front-matter or a theme JSON:

```
width, height, margin, minScale, maxScale
controls, controlsTutorial, controlsLayout, controlsBackArrows
progress, slideNumber, showSlideNumber
hash, hashOneBasedIndex, respondToHashChanges, jumpToSlide, history
keyboard, keyboardCondition, disableLayout, overview, center, touch
loop, rtl, navigationMode, shuffle
fragments, fragmentInURL, embedded, help, pause, showNotes
transition, transitionSpeed, backgroundTransition
autoSlide, autoSlideStoppable, autoSlideMethod, defaultTiming
mouseWheel, previewLinks, postMessage, postMessageEvents
focusBodyOnPageVisibilityChange
pdfMaxPagesPerSlide, pdfSeparateFragments, pdfPageHeightOffset
parallaxBackgroundImage, parallaxBackgroundSize
parallaxBackgroundHorizontal, parallaxBackgroundVertical
viewDistance, mobileViewDistance
```

Not all are whitelisted in this app's front-matter — see [README.md](README.md) for the accepted subset.

---

## Common gotchas

- **`data-src` unloads when far from view** (governed by `viewDistance`). For media that must keep state, use plain `src`.
- **`data-autoplay` needs prior user interaction** in most browsers. The first slide's autoplay often fails until the user has clicked or pressed a key.
- **`data-preview-link` fails for same-origin-locked URLs** — many sites send `X-Frame-Options: deny` and Chromium blocks the iframe.
- **Fragments reset on slide re-entry** unless `fragmentInURL: true` is set and you deep-link.
- **`data-state="foo"` adds classes to `<body>`, not the slide** — use it to trigger global CSS/JS, not slide-scoped styling.
- **Nested iframes inherit sandbox** — since decks run inside a sandboxed outer iframe, `data-background-iframe` content is further restricted.

---

## What this app adds on top

| Feature | Where documented |
|---|---|
| `SlideController.registerSlide` / `registerReset` / `registerSlideInit` | [reveal/plugin/slide-controller/index.js](reveal/plugin/slide-controller/index.js) |
| `<!-- .slide: data-no-logo -->` hides theme logo | [README.md](README.md) → Logo |
| `{current}` / `{total}` tokens in footer | [README.md](README.md) → Footer |
| Front-matter scalar keys → `Reveal.initialize(...)` | [README.md](README.md) |
| Front-matter `scripts:` / `styles:` / `theme:` | [README.md](README.md) |
| User themes at `<presentations>/_themes/<name>/` | [README.md](README.md) → Themes |
