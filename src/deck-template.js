/**
 * Deck HTML wrapper generator.
 *
 * When a deck folder contains `deck.md` but no `index.html`, the main process
 * calls {@link renderDeckHtml} to generate an HTML wrapper on the fly. The
 * wrapper loads Reveal.js, the standard plugins, SlideController, and the
 * deck's optional `deck.js` / `deck.css`, then kicks off `DeckInit.initialize`
 * with Reveal overrides pulled from the deck's front-matter.
 *
 * The markdown body is inlined into a `<section data-markdown>` block rather
 * than fetched by Reveal's markdown plugin at runtime — that sidesteps the
 * null-origin fetch issues that apply inside the sandboxed deck iframe.
 */

import { revealOverrides, extractAssets, themeOverrides } from './front-matter.js';

/**
 * Escape a value for safe inclusion in HTML text or a quoted attribute.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Alias of {@link escapeHtml} for attribute contexts. */
function escapeAttr(value) {
  return escapeHtml(value);
}

/**
 * Neutralize closing `</textarea>` or `</script>` sequences inside a chunk of
 * text that will be embedded in a `<textarea>` (which in turn sits inside
 * `<script>`-adjacent HTML). Prevents deck markdown from breaking out of the
 * wrapper and injecting arbitrary DOM.
 *
 * @param {string} value Markdown body.
 * @returns {string}
 */
function escapeForTextarea(value) {
  return value.replace(/<\/(textarea|script)/gi, '<\\/$1');
}

/** Render a list of URLs as `<link rel="stylesheet" ...>` tags. */
function renderStyleTags(urls) {
  return urls.map((u) => `  <link rel="stylesheet" href="${escapeAttr(u)}" />`).join('\n');
}

/** Render a list of URLs as `<script src="...">` tags. */
function renderScriptTags(urls) {
  return urls.map((u) => `  <script src="${escapeAttr(u)}"></script>`).join('\n');
}

/** `true` if `value` is a URL-like string (starts with / or scheme). */
function looksLikeUrl(value) {
  return typeof value === 'string' && /^(\/|https?:\/\/)/.test(value);
}

/**
 * Resolve a `font:` entry to a link tag + the CSS font-family value.
 * - URL → emit a `<link>` to that stylesheet, font-family inherits from it.
 * - Bare name → pull from Google Fonts, use the name as the family.
 * - Anything else (quoted stack) → no link, just use the value as the family.
 *
 * @returns {{ linkTag: string, family: string|null }}
 */
function resolveFont(fontValue) {
  if (!fontValue) return { linkTag: '', family: null };
  if (looksLikeUrl(fontValue)) {
    return { linkTag: `  <link rel="stylesheet" href="${escapeAttr(fontValue)}" />`, family: null };
  }
  const trimmed = String(fontValue).trim();
  if (trimmed.includes(',') || trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return { linkTag: '', family: trimmed };
  }
  const gfUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(trimmed).replace(/%20/g, '+')}&display=swap`;
  return {
    linkTag: `  <link rel="stylesheet" href="${escapeAttr(gfUrl)}" />`,
    family: `"${trimmed.replace(/"/g, '\\"')}", sans-serif`,
  };
}

/**
 * Build the `<style>` block that applies theme front-matter overrides.
 * Emitted AFTER reveal.css so these rules win.
 *
 * @returns {{ linkTags: string, styleBlock: string }}
 */
function renderThemeTags(theme) {
  const linkTagParts = [];
  const rules = [];
  const bodyFont = resolveFont(theme.font);
  const monoFont = resolveFont(theme.monospaceFont);
  if (bodyFont.linkTag) linkTagParts.push(bodyFont.linkTag);
  if (monoFont.linkTag) linkTagParts.push(monoFont.linkTag);

  const revealRules = [];
  const revealHeadingRules = [];

  if (bodyFont.family) revealRules.push(`font-family: ${bodyFont.family};`);
  if (theme.textColor) revealRules.push(`color: ${theme.textColor};`);
  if (theme.backgroundColor) revealRules.push(`background-color: ${theme.backgroundColor};`);

  if (theme.headingColor) revealHeadingRules.push(`color: ${theme.headingColor};`);
  if (bodyFont.family) revealHeadingRules.push(`font-family: ${bodyFont.family};`);

  if (revealRules.length) {
    rules.push(`.reveal, .reveal .slides section { ${revealRules.join(' ')} }`);
  }
  if (revealHeadingRules.length) {
    rules.push(`.reveal h1, .reveal h2, .reveal h3, .reveal h4, .reveal h5, .reveal h6 { ${revealHeadingRules.join(' ')} }`);
  }
  if (theme.linkColor) {
    rules.push(`.reveal a { color: ${theme.linkColor}; }`);
  }
  if (theme.accentColor) {
    rules.push(`.reveal .progress, .reveal .controls { color: ${theme.accentColor}; }`);
    rules.push(`.reveal .progress span { background: ${theme.accentColor}; }`);
  }
  if (theme.backgroundColor) {
    rules.push(`html, body { background-color: ${theme.backgroundColor}; }`);
  }
  if (monoFont.family) {
    rules.push(`.reveal pre, .reveal code { font-family: ${monoFont.family}; }`);
  }

  const linkTags = linkTagParts.length ? linkTagParts.join('\n') + '\n' : '';
  const styleBlock = rules.length ? `  <style>\n    ${rules.join('\n    ')}\n  </style>\n` : '';
  return { linkTags, styleBlock };
}

/** highlight.js theme CSS link (defaults to monokai). */
function renderHighlightLink(highlightTheme) {
  const name = highlightTheme || 'monokai';
  return `  <link rel="stylesheet" href="/plugin/highlight/${encodeURIComponent(name)}.css" />`;
}

/**
 * Build the chrome layer (logo + footer) that overlays the deck iframe.
 * Returns `{ html, css }` — both are empty strings if no chrome is needed.
 *
 * @param {Record<string, unknown>} theme Merged theme + front-matter object.
 * @returns {{ html: string, css: string }}
 */
function renderChrome(theme) {
  const logo = typeof theme.logo === 'string' ? theme.logo : null;
  const logoPosition = LOGO_POSITIONS.has(theme.logoPosition) ? theme.logoPosition : 'bottom-right';
  const logoHeight = typeof theme.logoHeight === 'number' ? theme.logoHeight : 60;
  const logoCustomPosition = typeof theme.logoCustomPosition === 'string' ? theme.logoCustomPosition : null;

  const footer = theme.footer;
  const showFooter = footer !== false;

  if (!logo && !showFooter) return { html: '', css: '' };

  const accent = typeof theme.accentColor === 'string' ? theme.accentColor : '#888';
  const textColor = typeof theme.textColor === 'string' ? theme.textColor : '#999';

  // Reveal's navigation arrows live in a ~100×100px box anchored at the
  // bottom-right corner (default font-size 10px → 3.6em arrows at
  // 12px inset). Both the footer's right edge and the bottom-right logo
  // must clear this area so nothing overlaps the controls. Derived from
  // Reveal's defaults (see reveal.css: `.reveal .controls`).
  const CONTROLS_CLEAR_X = 100;   // px of horizontal space to reserve
  const CONTROLS_CLEAR_Y = 100;   // px of vertical space to reserve
  const FOOTER_HEIGHT = 36;        // matches the footer's padding + line-height

  const cssRules = [
    '.deck-chrome { position: fixed; inset: 0; pointer-events: none; z-index: 100; }',
  ];
  const htmlParts = [];

  if (logo) {
    // Bottom-right collides with Reveal arrows → push in by CONTROLS_CLEAR_X.
    // Bottom-{left,center} only need to clear the footer strip height.
    const bottomOffset = showFooter ? FOOTER_HEIGHT + 8 : 16;
    const bottomRightInset = CONTROLS_CLEAR_X + 12;
    cssRules.push(
      '.deck-chrome .logo { position: absolute; height: ' + logoHeight + 'px; width: auto; }',
      '.deck-chrome .logo.pos-top-left    { top: 16px;    left: 24px; }',
      '.deck-chrome .logo.pos-top-right   { top: 16px;    right: 24px; }',
      '.deck-chrome .logo.pos-top-center  { top: 16px;    left: 50%; transform: translateX(-50%); }',
      '.deck-chrome .logo.pos-bottom-left  { bottom: ' + bottomOffset + 'px; left: 24px; }',
      '.deck-chrome .logo.pos-bottom-right { bottom: ' + bottomOffset + 'px; right: ' + bottomRightInset + 'px; }',
      '.deck-chrome .logo.pos-bottom-center{ bottom: ' + bottomOffset + 'px; left: 50%; transform: translateX(-50%); }',
      // Larger centered logo on the title slide (Reveal marks the first slide with .present on load).
      '.reveal .slides > section:first-of-type[data-title-logo] .title-logo { display: block; max-width: 60%; height: auto; margin: 0 auto 1em; }',
      // Hide the corner logo whenever the current slide opts out.
      '.reveal .slides section[data-no-logo].present ~ * .deck-chrome .logo { display: none; }',
    );
    const posClass = logoCustomPosition ? '' : 'pos-' + logoPosition;
    const inlineStyle = logoCustomPosition ? ' style="' + escapeAttr(logoCustomPosition) + '"' : '';
    htmlParts.push(
      '  <img class="logo ' + posClass + '" src="' + escapeAttr(logo) + '" alt=""' + inlineStyle + ' />'
    );
  }

  if (showFooter) {
    // Right padding is enlarged so the right-side footer text clears
    // Reveal's bottom-right navigation arrows.
    const footerRightPad = CONTROLS_CLEAR_X + 12;
    cssRules.push(
      '.deck-chrome .footer { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: center; padding: 8px 24px; padding-right: ' + footerRightPad + 'px; font-size: 14px; color: ' + textColor + '; background: linear-gradient(to top, rgba(0,0,0,0.35), transparent); }',
      '.deck-chrome .footer .left, .deck-chrome .footer .right { opacity: 0.85; }',
      '.deck-chrome .footer a { color: ' + accent + '; }',
    );

    // Resolve footer sides. The theme-merge already applied deck overrides,
    // so `theme.footer` is either an object with left/right, or undefined.
    const obj = (footer && typeof footer === 'object' && !Array.isArray(footer)) ? footer : {};
    const hasExplicitLeft = 'left' in obj;
    const leftContent = hasExplicitLeft ? escapeHtml(obj.left) : '';
    const rightContent = 'right' in obj ? escapeHtml(obj.right) : '{current}/{total}';

    htmlParts.push(
      '  <div class="footer">',
      '    <span class="left">' + leftContent + '</span>',
      '    <span class="right">' + rightContent + '</span>',
      '  </div>'
    );
  }

  const css = cssRules.map((r) => '    ' + r).join('\n');
  const html = '  <div class="deck-chrome">\n' + htmlParts.join('\n') + '\n  </div>';
  return { html, css };
}

/** Set of valid logo positions (mirrors front-matter validator). */
const LOGO_POSITIONS = new Set([
  'top-left', 'top-right', 'top-center',
  'bottom-left', 'bottom-right', 'bottom-center',
]);

/**
 * Generate the full HTML document for a deck.
 *
 * Script/link load order (top to bottom of the generated HTML):
 *   1. Reveal core CSS (reset, reveal, highlight theme)
 *   2. Front-matter `styles:` entries
 *   3. Deck-local `deck.css` (if present)
 *   4. Reveal core JS + bundled plugins
 *   5. SlideController core + DeckInit
 *   6. Front-matter `scripts:` entries (e.g. d3, anime, d3-helpers)
 *   7. `DeckInit.initialize({ ...overrides })` + focus bootstrap
 *   8. Deck-local `deck.js` (if present) — runs after SlideController is ready
 *
 * @param {object} opts
 * @param {Record<string, unknown>} opts.frontMatter Parsed front-matter map.
 * @param {string} opts.markdownBody Markdown body with front-matter stripped.
 * @param {boolean} opts.hasDeckJs Whether the deck folder has a `deck.js`.
 * @param {boolean} opts.hasDeckCss Whether the deck folder has a `deck.css`.
 * @returns {string} Complete HTML document, ready to serve as `text/html`.
 */
/**
 * Generate the full HTML document for a deck.
 *
 * @param {object} opts
 * @param {Record<string, unknown>} opts.frontMatter Merged (theme + deck)
 *   front-matter. The deck's values already win on conflicts.
 * @param {string} opts.markdownBody Markdown body with front-matter stripped.
 * @param {boolean} opts.hasDeckJs
 * @param {boolean} opts.hasDeckCss
 * @param {string|null} [opts.themeCssHref] URL to `theme.css` if the theme
 *   ships one. Linked after reveal.css and before deck.css.
 * @param {string|null} [opts.themeName] Active theme name, for debugging.
 */
export function renderDeckHtml({ frontMatter, markdownBody, hasDeckJs, hasDeckCss, themeCssHref, themeName }) {
  const title = escapeHtml(frontMatter.title || 'Presentation');
  const safeBody = escapeForTextarea(markdownBody || '');
  const { scripts, styles } = extractAssets(frontMatter);
  const theme = themeOverrides(frontMatter);

  const extraStyles = styles.length ? renderStyleTags(styles) + '\n' : '';
  const extraScripts = scripts.length ? renderScriptTags(scripts) + '\n' : '';
  const highlightLink = renderHighlightLink(theme.highlightTheme) + '\n';
  const { linkTags: themeLinks, styleBlock: themeStyles } = renderThemeTags(theme);
  const themeCssLink = themeCssHref
    ? `  <link rel="stylesheet" href="${escapeAttr(themeCssHref)}" />\n`
    : '';
  const { html: chromeHtml, css: chromeCss } = renderChrome(theme);
  const chromeStyleBlock = chromeCss ? `  <style>\n${chromeCss}\n  </style>\n` : '';

  // Avoid duplicating Reveal's built-in slide number when the chrome
  // footer is already rendering a counter. Respect explicit author
  // overrides (the key being present in frontMatter) even so.
  const overrides = revealOverrides(frontMatter);
  if (chromeHtml && theme.footer !== false && !('slideNumber' in frontMatter)) {
    overrides.slideNumber = false;
  }
  const overridesJson = JSON.stringify(overrides);

  const deckCssTag = hasDeckCss
    ? '  <link rel="stylesheet" href="deck.css" />\n'
    : '';
  const deckJsTag = hasDeckJs
    ? '  <script src="deck.js"></script>\n'
    : '';

  const themeMeta = themeName ? `  <meta name="deck-theme" content="${escapeAttr(themeName)}" />\n` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${themeMeta}  <title>${title}</title>
  <link rel="stylesheet" href="/reveal/reset.css" />
  <link rel="stylesheet" href="/reveal/reveal.css" />
${highlightLink}${themeLinks}${themeCssLink}${extraStyles}${themeStyles}${chromeStyleBlock}${deckCssTag}</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section data-markdown><textarea data-template>
${safeBody}
</textarea></section>
    </div>
  </div>
${chromeHtml}
  <script src="/reveal/reveal.js"></script>
  <script src="/plugin/markdown.js"></script>
  <script src="/plugin/highlight.js"></script>
  <script src="/plugin/notes.js"></script>
  <script src="/plugin/zoom.js"></script>
  <script src="/plugin/search.js"></script>
  <script src="/plugin/slide-controller/index.js"></script>
  <script src="/reveal/deck-init.js"></script>
${extraScripts}  <script>
    DeckInit.initialize(${overridesJson});
    // Pull keyboard focus into the deck document so arrow keys work
    // without requiring a click. The host focuses the iframe element,
    // but only the document itself can move focus into Reveal.
    Reveal.on('ready', function () {
      try {
        window.focus();
        if (document.body && document.body.focus) document.body.focus();
      } catch (_e) {}
    });
    // Footer token interpolation: replace {current}/{total} on slidechanged.
    (function () {
      var footer = document.querySelector('.deck-chrome .footer');
      if (!footer) return;
      var tmpl = {
        left: footer.querySelector('.left').textContent,
        right: footer.querySelector('.right').textContent,
      };
      function update() {
        var total = Reveal.getTotalSlides();
        var current = Reveal.getSlidePastCount() + 1;
        footer.querySelector('.left').textContent =
          tmpl.left.replace(/\\{current\\}/g, current).replace(/\\{total\\}/g, total);
        footer.querySelector('.right').textContent =
          tmpl.right.replace(/\\{current\\}/g, current).replace(/\\{total\\}/g, total);
      }
      Reveal.on('ready', update);
      Reveal.on('slidechanged', update);
    })();
  </script>
${deckJsTag}</body>
</html>
`;
}
