# Presentations App

A universal [Reveal.js](https://revealjs.com/) presentation viewer built with Electron. Point it at a folder of presentations and browse, open, and present them all from one place.

## Presentation Structure

Each presentation lives in its own subfolder inside your presentations folder:

```
presentations/
├── my-talk/
│   ├── my-talk.md        # Required — slide content in Markdown
│   ├── deck.css           # Optional — custom styles for this deck
│   ├── deck.js            # Optional — Reveal.js config overrides
│   └── media/             # Optional — images, videos, etc.
│       ├── diagram.png
│       └── demo.mp4
├── another-talk/
│   ├── slides.md
│   └── deck.css
└── legacy-talk/
    └── index.html         # Also supported — full custom HTML
```

### Files

| File | Required | Description |
|------|----------|-------------|
| `*.md` | Yes | Markdown file containing your slides. Slide separators: `\n\n\n` (horizontal) and `\n\n` (vertical). Speaker notes start with `Note:`. |
| `deck.css` | No | Custom CSS loaded after the base theme. Use this for per-presentation styling (custom fonts, colors, layouts, etc.). |
| `deck.js` | No | JavaScript file that exports Reveal.js config overrides. Called as `DeckInit.initialize({ ...overrides })`. |
| `media/` | No | Directory for images, videos, and other assets. Reference them in your Markdown with relative paths (e.g., `![](media/diagram.png)`). |
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

### Config Overrides (deck.js)

Add a `deck.js` to customize Reveal.js behavior for a specific presentation:

```javascript
DeckInit.initialize({
    transition: 'fade',
    autoSlide: 5000,
    loop: true
});
```

## Navigation

- **Home button** (top-left) — return to the presentation list from any deck
- **Cmd+Shift+H** — return home via keyboard
- **Cmd+O** — open a different presentations folder
