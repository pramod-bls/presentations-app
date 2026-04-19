/**
 * Minimal YAML-ish front-matter parser.
 *
 * Scoped deliberately narrow: we don't want a full YAML parser living in the
 * main bundle, and we don't want user-authored front-matter to override
 * arbitrary Reveal internals. Only keys in the allowlists below are honored.
 *
 * Supported syntax:
 *   ---
 *   title: My Talk                  # scalar (string/number/bool/null)
 *   transition: "fade"              # quoted strings are unwrapped
 *   scripts: [a.js, b.js]           # inline list
 *   styles:                         # block list
 *     - a.css
 *     - b.css
 *   ---
 *
 * Unknown keys are silently dropped. Unterminated front-matter (no closing
 * `---`) is treated as no front-matter (the whole source is the body).
 */

/**
 * Keys that are passed straight through to `Reveal.initialize(...)`.
 * `title` and `theme` are consumed by the template instead, but must be
 * parsed here so we can strip them before forwarding to Reveal.
 */
const REVEAL_CONFIG_KEYS = new Set([
  'title',
  'theme',
  'transition',
  'transitionSpeed',
  'backgroundTransition',
  'controls',
  'progress',
  'slideNumber',
  'center',
  'hash',
  'history',
  'autoSlide',
  'autoSlideStoppable',
  'loop',
  'rtl',
  'showNotes',
  'width',
  'height',
  'margin',
  'pdfMaxPagesPerSlide',
  'pdfSeparateFragments',
]);

/**
 * Theme-only keys rendered into a `<style>` block. Not forwarded to Reveal.
 */
const THEME_KEYS = new Set([
  'font',
  'monospaceFont',
  'backgroundColor',
  'textColor',
  'headingColor',
  'linkColor',
  'accentColor',
  'highlightTheme',
  'logo',
  'logoPosition',
  'logoHeight',
  'logoCustomPosition',
]);

/**
 * Keys that support nested map-valued front-matter (`footer:` block
 * with `left:` / `right:` sub-keys). `footer` can also be a plain
 * string (→ sugar for `{ right: <str> }`) or `false` to disable.
 */
const ALLOWED_MAP_KEYS = new Set(['footer']);

const ALLOWED_KEYS = new Set([...REVEAL_CONFIG_KEYS, ...THEME_KEYS]);

/** List-valued keys (YAML block or inline list). */
const ALLOWED_LIST_KEYS = new Set(['scripts', 'styles']);

// ── Value validators ────────────────────────────────────────
// Silently drop invalid values so a typo in front-matter can't nuke the
// whole deck. Each validator takes a coerced scalar and returns the
// sanitized value or `undefined` to drop the key.

/** Safe CSS color (hex, rgb/rgba, hsl/hsla, or a named color). */
function validateColor(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^rgba?\(\s*[\d.,%\s]+\s*\)$/.test(v)) return v;
  if (/^hsla?\(\s*[\d.,%\s]+\s*\)$/.test(v)) return v;
  // Named CSS colors — allow letters only, bounded length.
  if (/^[a-zA-Z]{3,32}$/.test(v)) return v;
  return undefined;
}

/** Font family name — letters, digits, spaces, basic punctuation. */
function validateFontName(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v || v.length > 80) return undefined;
  if (!/^[A-Za-z0-9 ,._'"+\-]+$/.test(v)) return undefined;
  return v;
}

/** highlight.js theme name — alphanumeric + dashes, bounded length. */
function validateHighlightTheme(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v || v.length > 40) return undefined;
  if (!/^[a-zA-Z0-9-]+$/.test(v)) return undefined;
  return v;
}

/** Positive integer within a sane range (for width/height/margin/autoSlide). */
function validatePositiveNumber(value, { max = 1000000 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    return undefined;
  }
  return value;
}

const LOGO_POSITIONS = new Set([
  'top-left', 'top-right', 'top-center',
  'bottom-left', 'bottom-right', 'bottom-center',
]);

/** Logo path — relative path inside deck or theme folder, or a URL. */
function validateLogoPath(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v || v.length > 500) return undefined;
  // Allow URLs, absolute app paths, or relative paths (no traversal).
  if (/^https?:\/\//.test(v)) return v;
  if (/\.\./.test(v)) return undefined;
  return v;
}

function validateLogoPosition(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  return LOGO_POSITIONS.has(v) ? v : undefined;
}

/**
 * Raw CSS positioning override for the logo (e.g. "top: 20px; right: 40px;").
 * Safe-list: only letters, digits, spaces, colons, semicolons, dots,
 * hyphens, percent, and px/em/rem units characters.
 */
function validateCustomPosition(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v || v.length > 200) return undefined;
  if (!/^[a-zA-Z0-9 :;.\-%]+$/.test(v)) return undefined;
  return v;
}

/**
 * Footer front-matter accepts three shapes:
 *   - `false`         → hide footer entirely
 *   - `"text"`        → sugar for `{ right: "text" }`
 *   - `{ left, right }` → full control; missing sides fall back to theme
 */
function validateFooter(value) {
  if (value === false) return false;
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v || v.length > 300) return undefined;
    return { right: v };
  }
  if (value && typeof value === 'object') {
    const out = {};
    if (typeof value.left === 'string' && value.left.length <= 300) out.left = value.left;
    if (typeof value.right === 'string' && value.right.length <= 300) out.right = value.right;
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

/**
 * Per-key validator registry. Missing entries pass through unchanged.
 * Returning `undefined` drops the key entirely.
 */
const VALIDATORS = {
  font: validateFontName,
  monospaceFont: validateFontName,
  backgroundColor: validateColor,
  textColor: validateColor,
  headingColor: validateColor,
  linkColor: validateColor,
  accentColor: validateColor,
  highlightTheme: validateHighlightTheme,
  logo: validateLogoPath,
  logoPosition: validateLogoPosition,
  logoHeight: (v) => validatePositiveNumber(v, { max: 2000 }),
  logoCustomPosition: validateCustomPosition,
  width: (v) => validatePositiveNumber(v, { max: 10000 }),
  height: (v) => validatePositiveNumber(v, { max: 10000 }),
  margin: (v) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : undefined),
  autoSlide: (v) => validatePositiveNumber(v, { max: 3600000 }),
  pdfMaxPagesPerSlide: (v) => validatePositiveNumber(v, { max: 1000 }),
  footer: validateFooter,
};

/**
 * Coerce a raw front-matter value into a JS primitive.
 * Handles booleans, null, integers, floats, and quoted strings.
 *
 * @param {string} value Raw value (post-colon, trimmed by caller).
 * @returns {string|number|boolean|null}
 */
function coerceScalar(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d*\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse an inline YAML list: `[a, b, c]` → `['a', 'b', 'c']`.
 * Each element goes through {@link coerceScalar}.
 *
 * @param {string} raw The bracketed source including `[` and `]`.
 * @returns {Array<string|number|boolean|null>}
 */
function parseInlineList(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((item) => coerceScalar(item));
}

/**
 * Split a markdown source into front-matter + body.
 *
 * Returns `{ frontMatter: {}, body: source }` when no front-matter is
 * present or the block is unterminated.
 *
 * @param {string} source Full markdown source of a deck file.
 * @returns {{ frontMatter: Record<string, unknown>, body: string }}
 */
export function parseFrontMatter(source) {
  if (!source.startsWith('---')) {
    return { frontMatter: {}, body: source };
  }
  const end = source.indexOf('\n---', 3);
  if (end === -1) {
    return { frontMatter: {}, body: source };
  }
  const block = source.slice(3, end).trim();
  const bodyStart = source.indexOf('\n', end + 4);
  const body = bodyStart === -1 ? '' : source.slice(bodyStart + 1);

  const frontMatter = {};
  const lines = block.split('\n');
  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) { i++; continue; }

    const colon = line.indexOf(':');
    if (colon === -1) { i++; continue; }

    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();

    if (ALLOWED_LIST_KEYS.has(key)) {
      if (rest.startsWith('[') && rest.endsWith(']')) {
        frontMatter[key] = parseInlineList(rest);
        i++;
        continue;
      }
      // Multi-line block list: consume subsequent "- value" lines.
      const items = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextTrimmed = next.trim();
        if (!nextTrimmed) { i++; continue; }
        if (!nextTrimmed.startsWith('- ') && nextTrimmed !== '-') break;
        items.push(coerceScalar(nextTrimmed.replace(/^-\s*/, '')));
        i++;
      }
      frontMatter[key] = items;
      continue;
    }

    if (ALLOWED_MAP_KEYS.has(key)) {
      // Map-valued key. `rest` non-empty → scalar shorthand or `false`.
      // Empty rest → expect indented sub-keys on following lines.
      if (rest !== '') {
        const raw = coerceScalar(rest);
        const validator = VALIDATORS[key];
        const sanitized = validator ? validator(raw) : raw;
        if (sanitized !== undefined) frontMatter[key] = sanitized;
        i++;
        continue;
      }
      const map = {};
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextTrimmed = next.trim();
        if (!nextTrimmed) { i++; continue; }
        // Sub-keys must be indented (have leading whitespace).
        if (next === nextTrimmed) break;
        const subColon = nextTrimmed.indexOf(':');
        if (subColon === -1) break;
        const subKey = nextTrimmed.slice(0, subColon).trim();
        const subRest = nextTrimmed.slice(subColon + 1).trim();
        map[subKey] = coerceScalar(subRest);
        i++;
      }
      const validator = VALIDATORS[key];
      const sanitized = validator ? validator(map) : map;
      if (sanitized !== undefined) frontMatter[key] = sanitized;
      continue;
    }

    if (ALLOWED_KEYS.has(key)) {
      const raw = coerceScalar(rest);
      const validator = VALIDATORS[key];
      const sanitized = validator ? validator(raw) : raw;
      if (sanitized !== undefined) frontMatter[key] = sanitized;
    }
    i++;
  }
  return { frontMatter, body };
}

/**
 * Extract Reveal.js config overrides from parsed front-matter.
 *
 * `title` and `theme` are metadata the template renders itself. Theme-only
 * keys (colors, fonts, highlightTheme) also live elsewhere in the template
 * and are excluded here.
 *
 * @param {Record<string, unknown>} frontMatter
 * @returns {Record<string, unknown>} Safe to pass to `DeckInit.initialize(...)`.
 */
export function revealOverrides(frontMatter) {
  const overrides = {};
  for (const key of REVEAL_CONFIG_KEYS) {
    if (key === 'title' || key === 'theme') continue;
    if (key in frontMatter) overrides[key] = frontMatter[key];
  }
  return overrides;
}

/**
 * Extract template-consumed overrides: theme tokens (fonts, colors,
 * highlight theme, logo…) plus the structured `footer` field.
 * Emitted into `<style>` blocks, link tags, or chrome DOM by the
 * template rather than forwarded to Reveal.
 *
 * @param {Record<string, unknown>} frontMatter
 * @returns {Record<string, unknown>}
 */
export function themeOverrides(frontMatter) {
  const theme = {};
  for (const key of THEME_KEYS) {
    if (key in frontMatter) theme[key] = frontMatter[key];
  }
  if ('footer' in frontMatter) theme.footer = frontMatter.footer;
  if ('theme' in frontMatter) theme.theme = frontMatter.theme;
  return theme;
}

/**
 * Pull `scripts:` and `styles:` asset lists out of front-matter, dropping
 * any non-string or empty entries.
 *
 * @param {Record<string, unknown>} frontMatter
 * @returns {{ scripts: string[], styles: string[] }}
 */
export function extractAssets(frontMatter) {
  const scripts = Array.isArray(frontMatter.scripts) ? frontMatter.scripts.filter((s) => typeof s === 'string' && s) : [];
  const styles = Array.isArray(frontMatter.styles) ? frontMatter.styles.filter((s) => typeof s === 'string' && s) : [];
  return { scripts, styles };
}
