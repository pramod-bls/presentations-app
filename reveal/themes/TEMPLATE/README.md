# Theme authoring template

This folder is a starting point for a custom theme. To use it:

1. **Copy the folder.** In the app: **File → Copy Built-in Theme to My Folder…**, pick `TEMPLATE`. Or manually copy `reveal/themes/TEMPLATE/` to `<your-presentations-folder>/_themes/<your-theme-name>/`.
2. **Rename** the cloned folder to your theme name (letters, digits, `-`, `_`; up to 64 chars).
3. **Edit `theme.json`** — fonts, colors, logo, footer defaults.
4. **Replace `logo.svg`** with your own logo (SVG recommended; PNG/JPG also work).
5. **Edit `theme.css`** — fine-grained CSS overrides. See the big comment in that file for what's available.
6. **Activate** in a deck: add `theme: <your-theme-name>` to the front-matter.

## Files in this folder

| File | Required | What it does |
|------|----------|--------------|
| `theme.json` | yes | Declarative values: fonts, colors, logo, footer. Keys match the deck front-matter schema. |
| `theme.css` | no | Custom CSS. Loaded after the deck template's inline theme block, so rules here win. Use it for things you can't express in `theme.json`: typography rhythm, custom fragment styles, element-specific colors, etc. |
| `logo.svg` | no | Logo referenced from `theme.json` → `logo: "logo.svg"`. Remove both if your theme has no logo. |
| `README.md` | no | This file. Delete it if you want. |

## Theme.json key reference

See [FRONT-MATTER-REFERENCE.md](../../../FRONT-MATTER-REFERENCE.md) — every key allowed in a deck's front-matter is also allowed in `theme.json`. The deck's front-matter overrides whatever the theme sets (last writer wins).

## Reveal CSS custom properties

Reveal 6 exposes every themeable value as a CSS custom property on `:root`. If you want a Reveal built-in theme as a starting point, copy-paste from `reveal/vendor/themes/src/*.scss` (the unminified Sass sources). Override properties in your `theme.css`:

```css
.reveal {
  --r-main-font: "Inter", sans-serif;
  --r-main-font-size: 42px;
  --r-main-color: #eee;

  --r-heading-font: "Inter", sans-serif;
  --r-heading-font-weight: 600;
  --r-heading-color: #fff;
  --r-heading-text-transform: none;  /* default is 'uppercase' */
  --r-heading1-size: 2.8em;

  --r-link-color: #42affa;
  --r-selection-color: #fff;
  --r-selection-background-color: #42affa;

  --r-code-font: "JetBrains Mono", monospace;

  /* Backgrounds */
  --r-background: #1a1a1a;
  --r-background-color: #1a1a1a;
}
```

Full list: see `reveal/vendor/themes/src/template/settings.scss` (every `--r-*` is defined at the bottom of that file).

## Testing your theme

1. Save your changes.
2. In the app: go to the home screen (**Go → Home** or **Cmd/Ctrl + Shift + H**). Themes are cached per-folder — changing the active folder clears the cache.
3. Alternatively: **quit and relaunch** the app. Themes are cached for the app's lifetime otherwise.
4. Open a deck that uses your theme. The deck file watcher catches changes to `theme.json` / `theme.css` only when the theme folder is inside the presentations folder (`_themes/`) and the deck references it — plain file edits inside the bundled `reveal/themes/` won't trigger live reload.

## Removing this theme

Delete the folder. The `custom-sample` theme still works as a fallback reference.
