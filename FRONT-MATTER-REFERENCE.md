# Front-matter reference

Every key you can set at the top of a `deck.md` file. All keys are optional. Values that fail validation are silently dropped — a typo can't break your deck.

```markdown
---
title: My Deck
theme: black
transition: fade
---

# First slide
```

Source of truth: [src/front-matter.js](src/front-matter.js).

---

## Identity

| Key | Type | Default | Effect |
|---|---|---|---|
| `title` | string | `Presentation` | `<title>` and default left-side footer |
| `theme` | string | — | Theme preset name. Lookup order: user `_themes/<name>/`, bundled `reveal/themes/<name>/`, Reveal built-in `reveal/vendor/themes/<name>.css` |

## Navigation

| Key | Type | Default | Effect |
|---|---|---|---|
| `transition` | `slide`\|`fade`\|`convex`\|`concave`\|`zoom`\|`none` | `slide` | Slide transition style |
| `transitionSpeed` | `default`\|`fast`\|`slow` | `default` | Transition speed |
| `backgroundTransition` | same as `transition` | `fade` | How slide backgrounds switch |
| `controls` | boolean | `true` | Show navigation arrows |
| `progress` | boolean | `true` | Show progress bar |
| `slideNumber` | boolean\|string | `false` in themed decks; `true` otherwise | Built-in slide counter. Auto-disabled when the chrome footer is active unless explicitly set |
| `center` | boolean | `true` | Vertically center slide content |
| `hash` | boolean | `true` | Use URL hash for deep links |
| `history` | boolean | `true` | Push history entries for each slide |
| `autoSlide` | number (ms) | `0` | Auto-advance every N ms (0 = off) |
| `autoSlideStoppable` | boolean | `true` | Pause auto-advance on user interaction |
| `loop` | boolean | `false` | Loop back to first slide after the last |
| `rtl` | boolean | `false` | Right-to-left slide order |
| `showNotes` | boolean | `false` | Embed speaker notes into the rendered HTML (useful for PDF export) |

## Layout (virtual canvas)

| Key | Type | Default | Effect |
|---|---|---|---|
| `width` | number | `1920` (via DeckInit) | Virtual canvas width in px |
| `height` | number | `1080` (via DeckInit) | Virtual canvas height in px |
| `margin` | number 0–1 | `0` (via DeckInit) | Fraction of canvas reserved around slides |

Slides scale to the viewport — `width`/`height` define the *aspect* the deck is authored for, not the actual rendering size.

## Typography

| Key | Type | Default | Effect |
|---|---|---|---|
| `font` | string | theme default | Body font. See **Font values** below |
| `monospaceFont` | string | theme default | Font for `<code>` / `<pre>` |

### Font values

Three forms accepted:

- **Bare name** (`"Inter"`) → pulled from Google Fonts automatically.
- **URL** (`"https://..."` or `"/reveal/vendor/my-font.css"`) → emitted as a `<link>` tag as-is.
- **Quoted stack** (`'"Inter", sans-serif'`) → used verbatim as `font-family`, no auto-load.

## Colors

All accept CSS colors: hex (`#0a0a0a`), `rgb()`/`rgba()`, `hsl()`/`hsla()`, or named colors.

| Key | Type | Effect |
|---|---|---|
| `backgroundColor` | color | Slide background + host background |
| `textColor` | color | Body text color |
| `headingColor` | color | `h1`–`h6` color |
| `linkColor` | color | `<a>` color |
| `accentColor` | color | Progress bar, controls, footer link color |

## Code highlighting

| Key | Type | Default | Effect |
|---|---|---|---|
| `highlightTheme` | string | `monokai` | highlight.js theme name. Looks up `/plugin/highlight/<name>.css` |

Only `monokai` ships by default. Add more by dropping highlight.js theme CSS files into `reveal/plugin/highlight/` (maintainer) or `<presentations>/_reveal/plugin/highlight/` (user override).

## Logo

| Key | Type | Default | Effect |
|---|---|---|---|
| `logo` | string | theme default | Path to image. Relative to deck folder, or absolute URL / `/reveal/...` / `/user-themes/...` |
| `logoPosition` | position | `bottom-right` | Named position (see below) |
| `logoHeight` | number (px) | `60` | Height at the virtual canvas resolution |
| `logoCustomPosition` | CSS string | — | Raw CSS positioning override (e.g. `"top: 32px; right: 64px;"`) |

**Named positions:** `top-left`, `top-right`, `top-center`, `bottom-left`, `bottom-right`, `bottom-center`.

**Per-slide opt-out:** add `<!-- .slide: data-no-logo -->` before a slide's content to hide the logo on that slide.

## Footer

| Key | Type | Effect |
|---|---|---|
| `footer` | `false`\|string\|object | See **Footer shapes** below |

### Footer shapes

```yaml
# Shape 1: string — sugar for { right: <string> }
footer: "Pramod · 2026"

# Shape 2: object — per-side control, missing sides fall back to theme
footer:
  left: "ACME Corp"
  right: "Slide {current}/{total}"

# Shape 3: disable
footer: false
```

**Tokens** available in footer strings:
- `{current}` — current slide index (1-based)
- `{total}` — total slide count

Interpolated on every `slidechanged` event.

## Assets (external libraries and stylesheets)

| Key | Type | Effect |
|---|---|---|
| `scripts` | list of URLs | `<script>` tags loaded before `deck.js` |
| `styles` | list of URLs | `<link>` tags loaded after theme CSS |

Both accept inline lists `[a, b, c]` or YAML block lists:

```yaml
scripts:
  - /reveal/vendor/d3.min.js
  - /plugin/slide-controller/d3-helpers.js
styles: [/reveal/vendor/extra.css]
```

URLs can be:
- Absolute (`https://...`) — loaded from the network. Null-origin sandbox requires CORS on the remote server.
- App-served (`/reveal/...`, `/plugin/...`, `/user-themes/...`) — served locally by the custom protocol handler.
- Relative — resolved against the deck folder.

Scripts load **before** `deck.js` so they're available when it runs.

## Export (PDF)

| Key | Type | Default | Effect |
|---|---|---|---|
| `pdfMaxPagesPerSlide` | number | `Infinity` | Max PDF pages to generate per slide when content overflows |
| `pdfSeparateFragments` | boolean | `true` | Each fragment gets its own PDF page |

## What's NOT allowed

Any key not listed above is silently dropped. In particular, these Reveal options are **not exposed**:

- `plugins` — the app decides which plugins load.
- `keyboard` / `keyboardCondition` — sandbox-restricted.
- `embedded` — would break the viewer iframe.
- `parallaxBackgroundImage` — if you need this, use a theme's `theme.css`.
- `math` — load math.js via `scripts:` and configure from `deck.js` if needed.

## Precedence

When the same key is defined in multiple places, the last writer wins:

```
Theme defaults → Reveal defaults (from deck-init.js) → Front-matter
                                                        ^^^^^^^^^^^ always wins
```

`footer` merges one level deep: `footer.left` and `footer.right` are combined independently from theme and front-matter.
