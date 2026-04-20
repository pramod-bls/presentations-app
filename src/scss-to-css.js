/**
 * Convert a Reveal.js theme's Sass source (from reveal/vendor/themes/src/)
 * into a clean, human-readable `theme.css` file that overrides the
 * `--r-*` CSS custom properties Reveal 6 exposes.
 *
 * Scope: just enough to handle the 12 upstream Reveal themes. Not a
 * general Sass compiler. Supports:
 *   - Top-level `$var: value;` definitions
 *   - `@use 'template/settings' with (...)` override blocks
 *   - `color.scale($var, $lightness: ±Npercent)` — the only Sass color
 *     function used across the upstream themes
 *   - `$var` references resolved against the top-level map
 *
 * Anything we can't resolve (e.g. unknown Sass functions, mixins) is
 * emitted as a CSS comment so the user can fix it manually.
 */

/**
 * Parse top-level `$name: value;` statements (not inside parens or
 * within `@use ... with (...)` blocks). Values may span multiple
 * lines — we consume until the terminating `;`.
 *
 * Returns a map of variable name → raw value string.
 */
function extractTopLevelVars(source) {
  const vars = {};
  let i = 0;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '(') { depth++; i++; continue; }
    if (ch === ')') { depth--; i++; continue; }
    if (depth > 0) { i++; continue; }

    // Skip whitespace to the start of a potential statement
    if (ch === '$') {
      // Match `$name:`
      const m = source.slice(i).match(/^\$([a-zA-Z0-9_-]+)\s*:\s*/);
      if (m) {
        const name = m[1];
        let j = i + m[0].length;
        // Consume until the next `;` at depth 0, skipping quotes
        let valueEnd = j;
        let localDepth = 0;
        let quote = null;
        while (valueEnd < source.length) {
          const c = source[valueEnd];
          if (quote) {
            if (c === '\\' && valueEnd + 1 < source.length) { valueEnd += 2; continue; }
            if (c === quote) quote = null;
            valueEnd++;
            continue;
          }
          if (c === '"' || c === "'") { quote = c; valueEnd++; continue; }
          if (c === '(') localDepth++;
          else if (c === ')') localDepth--;
          if (c === ';' && localDepth === 0) break;
          valueEnd++;
        }
        const rawValue = source.slice(j, valueEnd).trim().replace(/\s+/g, ' ');
        vars[name] = rawValue;
        i = valueEnd + 1;
        continue;
      }
    }

    i++;
  }
  return vars;
}

/**
 * Extract the `@use 'template/settings' with (...)` override block.
 * Returns a map of overridden variable names → raw value strings.
 */
function extractSettingsOverrides(source) {
  const start = source.search(/@use\s+['"]template\/settings['"]\s+with\s*\(/);
  if (start === -1) return {};
  // Find matching close paren
  let i = source.indexOf('(', start);
  if (i === -1) return {};
  let depth = 1;
  let j = i + 1;
  while (j < source.length && depth > 0) {
    if (source[j] === '(') depth++;
    else if (source[j] === ')') depth--;
    if (depth === 0) break;
    j++;
  }
  const block = source.slice(i + 1, j);

  const overrides = {};
  // Split on commas at depth 0 of the block (so commas inside nested
  // function calls stay grouped).
  const entries = splitAtDepth(block, ',');
  for (const entry of entries) {
    const m = entry.match(/^\s*\$([a-zA-Z0-9_-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (m) overrides[m[1]] = m[2].trim();
  }
  return overrides;
}

/**
 * Split a string on `sep` but only at paren-/brace-depth 0 and outside
 * string literals. Handles `"...,..."`, `'...,...'`, and Sass
 * interpolations like `#{...,...}` without splitting inside them.
 */
function splitAtDepth(str, sep) {
  const out = [];
  let depth = 0;
  let quote = null; // `"` or `'` while inside a string, else null
  let buf = '';
  for (let idx = 0; idx < str.length; idx++) {
    const ch = str[idx];
    if (quote) {
      if (ch === '\\' && idx + 1 < str.length) {
        buf += ch + str[idx + 1];
        idx++;
        continue;
      }
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '{') depth++;
    else if (ch === ')' || ch === '}') depth--;
    if (ch === sep && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** Parse `#rgb`, `#rrggbb`, or `#rrggbbaa` to an { r, g, b } tuple. */
function parseHex(hex) {
  const s = hex.replace('#', '').trim();
  if (s.length === 3) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    };
  }
  if (s.length === 6 || s.length === 8) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }
  return null;
}

function toHex(n) {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0');
}

/**
 * Implement Sass `color.scale($color, $lightness: percent)`.
 * Positive % blends the color toward white, negative toward black.
 * Matches Sass's `scale-color` algorithm: channel += (bound - channel) * pct.
 */
function colorScaleLightness(hex, lightnessPct) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const pct = lightnessPct / 100;
  const target = pct >= 0 ? 255 : 0;
  const t = Math.abs(pct);
  const r = rgb.r + (target - rgb.r) * t;
  const g = rgb.g + (target - rgb.g) * t;
  const b = rgb.b + (target - rgb.b) * t;
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Resolve a value that may contain `$var` references or a single
 * `color.scale(...)` call. Returns a CSS-safe string, or a comment
 * if we couldn't resolve it.
 */
function resolveValue(raw, vars) {
  let value = raw.trim();

  // Strip Sass interpolation wrappers: `#{expr}` → `expr`. Sass uses
  // these to force string interpolation inside another string; in our
  // plain CSS output they're not needed.
  const interp = value.match(/^#\{([\s\S]+)\}$/);
  if (interp) value = interp[1].trim();

  // Strip surrounding quotes on quoted-string values that wrap a CSS
  // token: `"'Source Sans Pro', Helvetica"` → `'Source Sans Pro', Helvetica`.
  // Sass uses the outer quotes to mark it as a single string token; CSS
  // doesn't need them. Handles both `"..."` and `'...'`.
  const dq = value.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (dq) value = dq[1];
  else {
    const sq = value.match(/^'((?:[^'\\]|\\.)*)'$/);
    if (sq) value = sq[1];
  }

  // color.scale($var, $lightness: Npercent)
  const scaleMatch = value.match(/^color\.scale\(\s*\$([a-zA-Z0-9_-]+)\s*,\s*\$lightness\s*:\s*(-?\d+(?:\.\d+)?)%\s*\)$/);
  if (scaleMatch) {
    const referenced = vars[scaleMatch[1]];
    if (referenced) {
      const resolved = resolveValue(referenced, vars);
      if (/^#[0-9a-fA-F]+$/.test(resolved)) {
        return colorScaleLightness(resolved, parseFloat(scaleMatch[2]));
      }
    }
    return `/* unresolved: ${raw} */`;
  }

  // Bare $var reference
  const varMatch = value.match(/^\$([a-zA-Z0-9_-]+)$/);
  if (varMatch) {
    const referenced = vars[varMatch[1]];
    if (referenced) return resolveValue(referenced, vars);
    return `/* unresolved: ${raw} */`;
  }

  // Contains one or more $vars inline (rare across Reveal themes, but handle)
  if (value.includes('$')) {
    const inlined = value.replace(/\$([a-zA-Z0-9_-]+)/g, (_, name) => {
      const ref = vars[name];
      return ref ? resolveValue(ref, vars) : `$${name}`;
    });
    if (inlined.includes('$')) return `/* unresolved: ${raw} */`;
    return inlined;
  }

  return value;
}

/**
 * Convert a parsed theme (top-level vars + settings overrides) into
 * a list of `{ property: '--r-foo', value: '...' }` entries in the
 * source order of the settings.scss `:root` block.
 *
 * We only emit properties the theme actually overrode — if the theme
 * left a default intact, don't put it in the user's theme.css (keeps
 * the output small and editable).
 */
const SETTINGS_ORDER = [
  ['background', '--r-background'],
  ['background-color', '--r-background-color'],
  ['main-font', '--r-main-font'],
  ['main-font-size', '--r-main-font-size'],
  ['main-color', '--r-main-color'],
  ['block-margin', '--r-block-margin'],
  ['heading-margin', '--r-heading-margin'],
  ['heading-font', '--r-heading-font'],
  ['heading-color', '--r-heading-color'],
  ['heading-line-height', '--r-heading-line-height'],
  ['heading-letter-spacing', '--r-heading-letter-spacing'],
  ['heading-text-transform', '--r-heading-text-transform'],
  ['heading-text-shadow', '--r-heading-text-shadow'],
  ['heading-font-weight', '--r-heading-font-weight'],
  ['heading1-text-shadow', '--r-heading1-text-shadow'],
  ['heading1-size', '--r-heading1-size'],
  ['heading2-size', '--r-heading2-size'],
  ['heading3-size', '--r-heading3-size'],
  ['heading4-size', '--r-heading4-size'],
  ['code-font', '--r-code-font'],
  ['link-color', '--r-link-color'],
  ['link-color-dark', '--r-link-color-dark'],
  ['link-color-hover', '--r-link-color-hover'],
  ['selection-background-color', '--r-selection-background-color'],
  ['selection-color', '--r-selection-color'],
  ['overlay-element-bg-color', '--r-overlay-element-bg-color'],
  ['overlay-element-fg-color', '--r-overlay-element-fg-color'],
];

/**
 * @param {string} source  Raw .scss file contents.
 * @returns {{ properties: Array<{ sass: string, css: string, value: string }>, raw: Record<string,string> }}
 */
export function parseScssTheme(source) {
  const topLevel = extractTopLevelVars(source);
  const overrides = extractSettingsOverrides(source);
  const properties = [];
  for (const [sassKey, cssKey] of SETTINGS_ORDER) {
    if (!(sassKey in overrides)) continue;
    const value = resolveValue(overrides[sassKey], topLevel);
    properties.push({ sass: sassKey, css: cssKey, value });
  }
  return { properties, raw: overrides };
}

/**
 * Format a parsed theme into a polished theme.css string. Header
 * credits the upstream source.
 */
export function renderThemeCss(themeName, parsed) {
  const lines = [];
  lines.push('/*');
  lines.push(` * ${themeName} — generated from Reveal.js ${themeName}.scss`);
  lines.push(` *`);
  lines.push(` * This file was seeded from the upstream Reveal.js theme. Edit freely —`);
  lines.push(` * every value is a CSS custom property you can override. Any key not`);
  lines.push(` * shown here will fall back to Reveal's defaults.`);
  lines.push(` *`);
  lines.push(` * See reveal/vendor/themes/src/template/settings.scss in the app for`);
  lines.push(` * the full list of available --r-* properties.`);
  lines.push(` */`);
  lines.push('');
  // Base rules + :root defaults come FIRST so the theme-specific
  // overrides that follow can override them (same specificity — last
  // declaration wins). Variables are declared on :root so
  // .reveal-viewport (which paints the slide background) can read
  // them: .reveal-viewport sits above .reveal in the DOM, so --r-*
  // values scoped only to .reveal would not inherit.
  lines.push(BASE_THEME_RULES);
  lines.push(':root {');
  for (const { css, value } of parsed.properties) {
    lines.push(`  ${css}: ${value};`);
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

/**
 * Rulesets that consume the --r-* custom properties plus :root defaults
 * for every var the theme might not set. Mirrors the upstream Reveal
 * base theme (reveal/vendor/themes/src/template/settings.scss +
 * template/theme.scss) — without these, setting --r-background-color
 * etc. has no visible effect because reveal.css itself doesn't read them,
 * and theme overrides that omit sizing/weight properties would render
 * with `initial` values (tiny fonts, wrong margins).
 */
export const BASE_THEME_RULES = `
:root {
  --r-background: #2b2b2b;
  --r-background-color: #bbb;
  --r-main-font: 'Lato', sans-serif;
  --r-main-font-size: 40px;
  --r-main-color: #eee;
  --r-block-margin: 20px;
  --r-heading-margin: 0 0 20px 0;
  --r-heading-font: 'League Gothic', Impact, sans-serif;
  --r-heading-color: #eee;
  --r-heading-line-height: 1.2;
  --r-heading-letter-spacing: normal;
  --r-heading-text-transform: uppercase;
  --r-heading-text-shadow: none;
  --r-heading-font-weight: normal;
  --r-heading1-text-shadow: none;
  --r-heading1-size: 3.77em;
  --r-heading2-size: 2.11em;
  --r-heading3-size: 1.55em;
  --r-heading4-size: 1em;
  --r-code-font: monospace;
  --r-link-color: #13daec;
  --r-link-color-hover: #71e9f4;
  --r-link-color-dark: #10b9c8;
  --r-selection-background-color: #0fadbb;
  --r-selection-color: #fff;
}

.reveal-viewport {
  background: var(--r-background);
  background-color: var(--r-background-color);
}

.reveal {
  font-family: var(--r-main-font);
  font-size: var(--r-main-font-size);
  font-weight: normal;
  color: var(--r-main-color);
}

.reveal ::selection {
  color: var(--r-selection-color);
  background: var(--r-selection-background-color);
  text-shadow: none;
}

.reveal ::-moz-selection {
  color: var(--r-selection-color);
  background: var(--r-selection-background-color);
  text-shadow: none;
}

.reveal h1,
.reveal h2,
.reveal h3,
.reveal h4,
.reveal h5,
.reveal h6 {
  margin: var(--r-heading-margin);
  color: var(--r-heading-color);
  font-family: var(--r-heading-font);
  font-weight: var(--r-heading-font-weight);
  line-height: var(--r-heading-line-height);
  letter-spacing: var(--r-heading-letter-spacing);
  text-transform: var(--r-heading-text-transform);
  text-shadow: var(--r-heading-text-shadow);
  word-wrap: break-word;
}

.reveal h1 { font-size: var(--r-heading1-size); text-shadow: var(--r-heading1-text-shadow); }
.reveal h2 { font-size: var(--r-heading2-size); }
.reveal h3 { font-size: var(--r-heading3-size); }
.reveal h4 { font-size: var(--r-heading4-size); }

.reveal a {
  color: var(--r-link-color);
  text-decoration: none;
  transition: color 0.15s ease;
}
.reveal a:hover {
  color: var(--r-link-color-hover);
}

.reveal .controls { color: var(--r-link-color); }
.reveal .progress {
  background: rgba(0, 0, 0, 0.2);
  color: var(--r-link-color);
}

.reveal code { font-family: var(--r-code-font); }
.reveal pre { font-family: var(--r-code-font); }

@media print {
  .backgrounds { background-color: var(--r-background-color); }
}
`;
