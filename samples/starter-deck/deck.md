---
# ─── Identity ───────────────────────────────────────────────
title: My New Deck

# ─── Theme preset (optional) ────────────────────────────────
# Three sources are searched, in order:
#   1. <presentations-folder>/_themes/<name>/  (your own themes)
#   2. reveal/themes/<name>/                     (bundled presets)
#   3. reveal/vendor/themes/<name>.css           (Reveal.js built-ins:
#      beige, black, blood, dracula, league, moon, night, serif,
#      simple, sky, solarized, white)
# Any front-matter key below overrides the theme's default.
theme: custom-sample

# ─── Navigation behavior ────────────────────────────────────
# transition: slide | fade | convex | concave | zoom | none
transition: fade
# transitionSpeed: default | fast | slow
transitionSpeed: default
# autoSlide: ms between auto-advances (0 = off). autoSlideStoppable: pause on click.
# autoSlide: 5000
# autoSlideStoppable: true
# loop: true          # loop back to the first slide after the last

# ─── Layout ─────────────────────────────────────────────────
# Virtual canvas dimensions. The deck scales to the viewport.
width: 1920
height: 1080
# margin: 0.04       # fraction of the canvas reserved around slides

# ─── Typography ─────────────────────────────────────────────
# font / monospaceFont:
#   - bare name   → pulled from Google Fonts  (e.g. "Inter")
#   - URL         → emitted as a <link>       (e.g. "/reveal/vendor/my.css")
#   - quoted stack → used as-is                ('"Inter", sans-serif')
# font: "Inter"
# monospaceFont: "JetBrains Mono"

# ─── Colors ─────────────────────────────────────────────────
# backgroundColor: "#0f172a"
# textColor: "#e2e8f0"
# headingColor: "#f8fafc"
# accentColor: "#38bdf8"    # progress bar, controls
# linkColor: "#38bdf8"

# ─── Code highlighting ──────────────────────────────────────
# highlightTheme: "monokai"   # a name that exists in reveal/plugin/highlight/

# ─── Logo (overrides the theme) ─────────────────────────────
# logo: "assets/my-logo.svg"
# logoPosition: top-right      # top-left | top-right | top-center |
#                              # bottom-left | bottom-right | bottom-center
# logoHeight: 64               # pixels at the virtual canvas resolution
# logoCustomPosition: "top: 32px; right: 64px;"  # overrides logoPosition

# ─── Footer ─────────────────────────────────────────────────
# Three forms:
#   footer: "Pramod · 2026"       # string → replaces the right side
#   footer:
#     left: "ACME Corp"           # full control of both sides
#     right: "Slide {current}/{total}"
#   footer: false                 # hide the footer entirely
# Tokens available: {current}, {total}

# ─── External libraries and stylesheets ─────────────────────
# scripts:
#   - /reveal/vendor/d3.min.js
#   - /plugin/slide-controller/d3-helpers.js
# styles:
#   - /reveal/vendor/my-extra.css
---

# My New Deck

Edit `deck.md` to change slide content; edit front-matter above to change
styling, fonts, or layout.

---

## Second Slide

- Write slides in Markdown.
- Separate horizontal slides with `---` on its own line.
- Separate vertical sub-slides with `--`.

```js
// deck.js can register per-slide animations:
SlideController.registerSlide('demo', [
  (id) => { /* first Enter step */ },
  (id) => { /* second Enter step */ },
]);
```

---

<!-- .slide: id="demo" -->
## Interactive Slide

Press **Enter** to advance the animation steps registered in `deck.js`.

Press **R** to reset the slide.

Note:
Speaker notes go here — press **S** to open the speaker view.
