# Presentations App

A universal [Reveal.js](https://revealjs.com/) presentation viewer built with Electron. Point it at a folder of presentations and browse, open, and present them all from one place.

## Architecture

The app bundles and serves three shared layers so that presentations don't need to ship their own copies:

| Layer | Bundled in app | Purpose |
|-------|----------------|---------|
| **Reveal.js** | `reveal/` (dist files) | Core slide engine — rendering, navigation, plugins (Markdown, Highlight, Notes, Zoom, Search) |
| **DeckInit** | `reveal/deck-init.js` | Shared initializer — sets sensible defaults (full-width, convex transition, slide numbers, etc.) and auto-detects loaded plugins |
| **SlideController** | `reveal/plugin/slide-controller/index.js` | D3/SVG animation framework — provides step-based slide animations controlled by Enter (advance) and R (reset) keys |

The app automatically generates an `index.html` for each deck that includes all the necessary script and CSS tags. Presentations only need to provide their own content.

### SlideController API

The plugin exposes `window.SlideController` for per-deck scripts to use:

```javascript
// Register animation steps for a slide (by container div ID)
SlideController.registerSlide('my-slide', [
    function (id) { SlideController.show(id, SlideController.sel('my-slide', 'my-svg').select('#step1')); },
    function (id) { SlideController.show(id, SlideController.sel('my-slide', 'my-svg').select('#step2')); },
]);

// Register custom reset logic
SlideController.registerReset('my-slide', function () {
    // runs when user presses R on this slide
});

// Register a one-time init when a slide is first shown
SlideController.registerSlideInit('my-slide', function () {
    // load SVGs, set up videos, etc.
});
```

**Available helpers:** `show()`, `hide()`, `sel()`, `loadSVG()`, `animatePath()`, `animatePathLin()`, `animatePathLin2()`, `animateImg()`, `morphPaths()`

## Presentation Structure

Each presentation lives in its own subfolder inside your presentations folder:

```
presentations/
├── my-talk/
│   ├── my-talk.md            # Required — slide content in Markdown
│   ├── deck.css              # Optional — custom styles for this deck
│   ├── deck.js               # Optional — animations & config overrides
│   └── media/                # Optional — images, videos, SVGs, etc.
│       ├── diagram.svg
│       └── demo.mp4
│
├── simple-talk/
│   └── slides.md             # A minimal deck — just Markdown, no extras
│
└── legacy-talk/
    └── index.html            # Also supported — full custom HTML
```

No shared files (Reveal.js, DeckInit, SlideController) need to exist in this folder — the app provides them all.

### Per-Deck Files

| File | Required | Description |
|------|----------|-------------|
| `*.md` | Yes | Markdown file containing your slides. Slide separators: `\n\n\n` (horizontal) and `\n\n` (vertical). Speaker notes start with `Note:`. |
| `deck.css` | No | Custom CSS loaded after the base theme. Use this for per-presentation styling (custom fonts, colors, layouts, etc.). |
| `deck.js` | No | JavaScript file for slide animations and/or config overrides. Can use `SlideController.registerSlide()` to define step-based D3/SVG animations, and/or call `DeckInit.initialize({ ...overrides })` to customize Reveal.js behavior. |
| `media/` | No | Directory for images, videos, SVGs, and other assets. Reference them in your Markdown with relative paths (e.g., `![](media/diagram.png)`). SVGs can be loaded into slides via `SlideController.loadSVG()` for D3 animation. |
| `index.html` | No | If present, used as-is instead of the generated template. This supports legacy presentations or fully custom setups. |

### Markdown Slide Format

Slides are written in standard Markdown with Reveal.js conventions:

```markdown
# Title Slide

First slide content



# Second Slide

Three blank lines separate horizontal slides


## Vertical Slide

Two blank lines separate vertical slides

Note:
Speaker notes go here — everything after `Note:` is hidden from the audience.



# Third Slide

- Reference media with relative paths
- ![](media/photo.jpg)
```

### Custom Styles (deck.css)

Add a `deck.css` to override or extend the base theme for a specific presentation:

```css
/* Change heading color */
.reveal h1, .reveal h2 {
    color: #e74c3c;
}

/* Custom slide background */
.reveal .slides section {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
}
```

### Animations & Config (deck.js)

A `deck.js` file can do two things:

**1. Register D3/SVG animations** using the SlideController:

```javascript
// Load an SVG and define step-based animations
SlideController.registerSlideInit('my-diagram', function () {
    SlideController.loadSVG('#my-diagram', 'media/diagram.svg', 'diagram', '0 0 1920 1080');
});

SlideController.registerSlide('my-diagram', [
    function (id) {
        // Step 1: show the first element with a bounce animation
        SlideController.show(id, SlideController.sel('my-diagram', 'diagram').select('#part1'))
            .each(SlideController.animatePath);
    },
    function (id) {
        // Step 2: reveal the next element
        SlideController.show(id, SlideController.sel('my-diagram', 'diagram').select('#part2'));
    },
]);
```

**2. Override Reveal.js config:**

```javascript
DeckInit.initialize({
    transition: 'fade',
    autoSlide: 5000,
    loop: true
});
```

### In-Presentation Controls

| Key | Action |
|-----|--------|
| Arrow keys | Navigate slides |
| **Enter** | Advance to next animation step (SlideController) |
| **R** | Reset current slide's animations |
| **S** | Open speaker notes |
| **Esc** | Reveal.js overview mode |
| **F** | Fullscreen |

## App Navigation

- **Home button** (top-left corner) — return to the presentation list
- **Cmd+Shift+H** — return home via keyboard
- **Cmd+O** — open a different presentations folder
