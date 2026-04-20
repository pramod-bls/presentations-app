/**
 * Electron main-process entry point.
 *
 * Responsibilities:
 *   - Own the single BrowserWindow that hosts the home screen and renders
 *     each deck inside a sandboxed `<iframe sandbox="allow-scripts">`.
 *   - Persist the user's chosen presentations folder across launches.
 *   - Serve bundled Reveal / plugin / vendor assets and generated deck HTML
 *     through a custom `file://` protocol handler.
 *   - Capture and cache thumbnail screenshots of decks for the home grid.
 *   - Expose a small IPC surface (get-decks / get-config / open-folder /
 *     get-thumbnail) to the renderer via `preload.js`.
 *
 * See ARCHITECTURE.md for the full data-flow picture.
 */
import { app, BrowserWindow, ipcMain, dialog, Menu, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { parseFrontMatter } from './front-matter.js';
import { renderDeckHtml } from './deck-template.js';
import { parseScssTheme, renderThemeCss } from './scss-to-css.js';

if (started) app.quit();

// ── Config persistence ──────────────────────────────────────
// A tiny JSON file in the app's userData dir. Single persisted key today:
// `presentationsFolder`. Intentionally no schema validation — if the file
// is corrupt, loadConfig() returns {} and the user re-picks their folder.

const configPath = path.join(app.getPath('userData'), 'config.json');

/** Read and parse the on-disk config, returning `{}` on any failure. */
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')); }
  catch { return {}; }
}

/** Overwrite the on-disk config with `config` (pretty-printed). */
function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/** Get the saved presentations folder, or `null` if none. */
function getPresentationsFolder() {
  return loadConfig().presentationsFolder || null;
}

/**
 * Persist `folderPath` as the user's active presentations folder. Also
 * invalidates the user-theme cache so themes from the new folder are
 * re-read on next access.
 */
function setPresentationsFolder(folderPath) {
  const config = loadConfig();
  config.presentationsFolder = folderPath;
  saveConfig(config);
  invalidateUserThemeCache();
}

/**
 * Whether the user has marked the active presentations folder as trusted.
 * Trusted folders get a relaxed sandbox that allows Reveal's built-in
 * popups (speaker-notes window, link previews). Untrusted folders use
 * the strict "allow-scripts only" sandbox.
 */
function isTrustedFolder() {
  const cfg = loadConfig();
  if (!cfg.presentationsFolder) return false;
  const trusted = Array.isArray(cfg.trustedFolders) ? cfg.trustedFolders : [];
  return trusted.includes(cfg.presentationsFolder);
}

function setFolderTrusted(folderPath, trusted) {
  const config = loadConfig();
  const list = new Set(Array.isArray(config.trustedFolders) ? config.trustedFolders : []);
  if (trusted) list.add(folderPath);
  else list.delete(folderPath);
  config.trustedFolders = [...list];
  saveConfig(config);
}

// ── Window ──────────────────────────────────────────────────

// Shared webPreferences for any window that loads deck content. We keep
// contextIsolation + nodeIntegration:false for renderer hardening, and
// disable webSecurity so sandboxed deck iframes can fetch same-folder
// assets through the custom file:// protocol handler.
const DECK_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: false,
};

let mainWindow;

/**
 * Navigate the main window back to the home grid.
 * Uses the Vite dev server URL in development, the built renderer in prod.
 * Safe to call before the window exists (no-op).
 */
function goHome() {
  if (!mainWindow) return;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

/** Create the single main BrowserWindow and load the home page. */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Presentations',
    webPreferences: {
      ...DECK_WEB_PREFERENCES,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  goHome();
};

// ── Menu ────────────────────────────────────────────────────

/** Build and install the application menu (File / View / Go + macOS app menu). */
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Presentations Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFolderDialog(),
        },
        {
          label: 'Trust This Folder (Enable Presenter Mode)',
          type: 'checkbox',
          checked: isTrustedFolder(),
          click: (menuItem) => {
            const folder = getPresentationsFolder();
            if (!folder) {
              menuItem.checked = false;
              return;
            }
            setFolderTrusted(folder, menuItem.checked);
            // Reload the home screen so subsequent deck opens pick up the new trust level.
            goHome();
          },
        },
        { type: 'separator' },
        {
          label: 'Export Current Deck as PDF…',
          accelerator: 'CmdOrCtrl+E',
          click: async () => {
            const folder = getActiveDeckFolder();
            if (!folder) {
              await dialog.showMessageBox(mainWindow, {
                type: 'info',
                message: 'No deck is open',
                detail: 'Open a deck first, then choose Export.',
              });
              return;
            }
            try {
              const out = await exportDeckPdf(folder);
              if (out) shell.openPath(out);
            } catch (err) {
              await dialog.showErrorBox('PDF export failed', String(err));
            }
          },
        },
        {
          label: 'Export Current Deck as Standalone HTML…',
          click: async () => {
            const folder = getActiveDeckFolder();
            if (!folder) {
              await dialog.showMessageBox(mainWindow, {
                type: 'info',
                message: 'No deck is open',
                detail: 'Open a deck first, then choose Export.',
              });
              return;
            }
            try {
              const out = await exportDeckStandalone(folder);
              if (out) shell.openPath(out);
            } catch (err) {
              await dialog.showErrorBox('Standalone export failed', String(err));
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Open User Themes Folder',
          click: () => openUserThemesFolder(),
        },
        {
          label: 'Copy Built-in Theme to My Folder...',
          click: () => cloneBundledTheme(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => goHome(),
        },
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+Left',
          click: () => {
            if (mainWindow?.webContents.canGoBack()) mainWindow.webContents.goBack();
          },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' }, { role: 'quit' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Folder dialog ───────────────────────────────────────────

/**
 * Show the native "choose folder" dialog. On confirm, persist the choice
 * and reload the home screen so it lists decks from the new folder.
 *
 * @returns {Promise<string|null>} The chosen path, or null if cancelled.
 */
async function openFolderDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Presentations Folder',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    setPresentationsFolder(result.filePaths[0]);
    goHome();
    return result.filePaths[0];
  }
  return null;
}

// ── Protocol handler ────────────────────────────────────────
// The renderer and every sandboxed deck iframe load content via `file://`.
// Electron's default file:// behavior just serves files from disk, which
// means:
//   - there is no way to map "virtual" paths like `/reveal/reveal.js` to
//     the bundled assets folder,
//   - there is no way to synthesize a deck's index.html on the fly.
//
// `registerProtocolHandler()` replaces the default handler with one that
// intercepts `/reveal/*`, `/plugin/*`, and missing `<deck>/index.html`
// requests, then falls through to the normal filesystem for everything
// else. Path-traversal is blocked via `resolveWithinBase`.

/** Known file extensions → MIME type. Unknown → application/octet-stream. */
const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.md': 'text/markdown', '.map': 'application/json',
};

/**
 * Build a `Response` serving the file at `diskPath`.
 * Adds `Access-Control-Allow-Origin: *` so null-origin sandboxed iframes
 * can fetch same-folder assets.
 *
 * @param {string} diskPath Absolute path to an existing file.
 */
function fileResponse(diskPath) {
  const ext = path.extname(diskPath).toLowerCase();
  return new Response(fs.readFileSync(diskPath), {
    headers: {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    },
  });
}


/**
 * Cache key: `<source>:<name>`. Cleared whenever the active presentations
 * folder changes so switching folders re-reads user themes from disk.
 *
 * @type {Map<string, { values: Record<string, unknown>, hasCss: boolean, cssHref: string|null } | null>}
 */
const themeCache = new Map();

/** Return the absolute path to the user's `_themes/` dir, or null. */
function userThemesDir() {
  const folder = getPresentationsFolder();
  if (!folder) return null;
  return path.join(folder, '_themes');
}

/**
 * Load a theme by name. Resolution order:
 *   1. User theme at `<presentationsFolder>/_themes/<name>/theme.json`
 *   2. Bundled preset at `reveal/themes/<name>/theme.json`
 *   3. Reveal.js built-in theme CSS at `reveal/vendor/themes/<name>.css`
 *
 * Returns `null` if no source matches. For Reveal built-ins we synthesize
 * a minimal theme entry whose only effect is linking the upstream CSS —
 * no fonts/colors/logo metadata, because the CSS handles it end-to-end.
 *
 * @param {string} name Theme name as it appears in front-matter.
 * @returns {{ values: Record<string, unknown>, hasCss: boolean, cssHref: string|null } | null}
 */
function loadTheme(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(name)) return null;

  const userDir = userThemesDir();
  if (userDir) {
    const userEntry = readThemeFromDisk({
      dir: path.join(userDir, name),
      assetPrefix: `/user-themes/${encodeURIComponent(name)}`,
      cacheKey: `user:${name}`,
    });
    if (userEntry) return userEntry;
  }

  const bundledEntry = readThemeFromDisk({
    dir: path.join(app.getAppPath(), 'reveal', 'themes', name),
    assetPrefix: `/reveal/themes/${encodeURIComponent(name)}`,
    cacheKey: `bundled:${name}`,
  });
  if (bundledEntry) return bundledEntry;

  // Reveal built-in theme (CSS only, no metadata).
  const revealThemePath = path.join(app.getAppPath(), 'reveal', 'vendor', 'themes', `${name}.css`);
  const revealCacheKey = `reveal:${name}`;
  if (themeCache.has(revealCacheKey)) return themeCache.get(revealCacheKey);
  if (fs.existsSync(revealThemePath)) {
    const entry = {
      values: {},
      hasCss: true,
      cssHref: `/reveal/vendor/themes/${encodeURIComponent(name)}.css`,
    };
    themeCache.set(revealCacheKey, entry);
    return entry;
  }
  themeCache.set(revealCacheKey, null);
  return null;
}

/**
 * Read and cache a theme from a specific directory. Rewrites relative
 * asset paths to the provided `assetPrefix` so they resolve via our
 * protocol handler (bundled themes → /reveal/themes/..., user themes →
 * /user-themes/...).
 */
function readThemeFromDisk({ dir, assetPrefix, cacheKey }) {
  if (themeCache.has(cacheKey)) return themeCache.get(cacheKey);
  const jsonPath = path.join(dir, 'theme.json');
  const cssPath = path.join(dir, 'theme.css');
  if (!fs.existsSync(jsonPath)) {
    themeCache.set(cacheKey, null);
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const values = sanitizeThemeObject(raw);
    if (typeof values.logo === 'string' && !/^(https?:\/\/|\/)/.test(values.logo)) {
      values.logo = `${assetPrefix}/${values.logo}`;
    }
    const hasCss = fs.existsSync(cssPath);
    const entry = {
      values,
      hasCss,
      cssHref: hasCss ? `${assetPrefix}/theme.css` : null,
    };
    themeCache.set(cacheKey, entry);
    return entry;
  } catch {
    themeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Clear cached user-theme entries. Call when the active presentations
 * folder changes — bundled themes stay cached (they're app-lifetime).
 */
function invalidateUserThemeCache() {
  for (const key of [...themeCache.keys()]) {
    if (key.startsWith('user:')) themeCache.delete(key);
  }
}

/** List the names of bundled preset themes (folders under reveal/themes/). */
function listBundledThemes() {
  const dir = path.join(app.getAppPath(), 'reveal', 'themes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

/**
 * List the Reveal.js built-in theme names (based on *.scss files in
 * reveal/vendor/themes/src/). We generate a theme folder from these
 * on demand via parseScssTheme/renderThemeCss.
 */
function listRevealThemes() {
  const dir = path.join(app.getAppPath(), 'reveal', 'vendor', 'themes', 'src');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.scss'))
    .map((e) => e.name.replace(/\.scss$/, ''))
    .sort();
}

/** Recursively copy `src` into `dst`, creating dirs as needed. */
function copyDirectory(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirectory(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

/**
 * Read the PowerPoint-layout + chrome/fragments/etc. commented recipes
 * from the TEMPLATE theme's theme.css. Everything from the first
 * "PowerPoint-style layout" marker to end-of-file — the Reveal-vars
 * block before it is redundant once a theme is active.
 *
 * Appended to every generated/cloned theme (except TEMPLATE itself,
 * which already has it) so users always have these recipes at hand.
 */
function readTemplateBoilerplate() {
  const p = path.join(app.getAppPath(), 'reveal', 'themes', 'TEMPLATE', 'theme.css');
  if (!fs.existsSync(p)) return '';
  const source = fs.readFileSync(p, 'utf-8');
  const marker = '/* ─── PowerPoint-style layout';
  const idx = source.indexOf(marker);
  if (idx === -1) return '';
  return source.slice(idx);
}

/**
 * Generate a user-theme folder (`theme.json` + `theme.css`) from a
 * Reveal.js built-in theme's Sass source. Produces a clean, human-
 * readable CSS file of `--r-*` custom property overrides — not
 * minified, freely editable.
 *
 * @param {string} themeName One of listRevealThemes() entries.
 * @param {string} dst Destination folder (created if missing).
 */
function generateThemeFromReveal(themeName, dst) {
  const scssPath = path.join(app.getAppPath(), 'reveal', 'vendor', 'themes', 'src', `${themeName}.scss`);
  if (!fs.existsSync(scssPath)) {
    throw new Error(`Reveal theme ${themeName} not found in vendor sources`);
  }
  fs.mkdirSync(dst, { recursive: true });

  const scssSource = fs.readFileSync(scssPath, 'utf-8');
  const parsed = parseScssTheme(scssSource);
  const css = renderThemeCss(themeName, parsed);
  const boilerplate = readTemplateBoilerplate();
  fs.writeFileSync(
    path.join(dst, 'theme.css'),
    boilerplate ? `${css.trimEnd()}\n\n${boilerplate}` : css
  );

  // Minimal theme.json — just enough to activate the theme via
  // `theme: <name>` in a deck, without fighting the CSS. Users can
  // add colors/fonts/logo/footer keys later.
  const themeJson = {
    footer: { right: '{current}/{total}' },
  };
  fs.writeFileSync(
    path.join(dst, 'theme.json'),
    JSON.stringify(themeJson, null, 2) + '\n'
  );

  // Write a short README explaining the seed.
  const readme = `# ${themeName}

Generated from the Reveal.js built-in \`${themeName}\` theme.

Everything in \`theme.css\` is a CSS custom property override — edit the
values to match your brand. Anything you remove falls back to Reveal's
defaults (see \`reveal/vendor/themes/src/template/settings.scss\` in the
app for the full list).

Add a logo, footer tweaks, fonts etc. to \`theme.json\` as you would for
any custom theme — see [FRONT-MATTER-REFERENCE.md](../../../FRONT-MATTER-REFERENCE.md).

Activate in a deck:

\`\`\`yaml
---
theme: ${path.basename(dst)}
---
\`\`\`
`;
  fs.writeFileSync(path.join(dst, 'README.md'), readme);
}

/**
 * Prompt the user to pick a built-in theme, then copy (for presets) or
 * generate (for Reveal built-ins) a user-editable copy under
 * `<presentationsFolder>/_themes/<name>/`. Existing folders prompt for
 * overwrite confirmation. Opens the result in Finder/Explorer on success.
 *
 * Two categories are offered:
 *   1. **Preset themes** (reveal/themes/*) — custom presets that ship with
 *      the app (TEMPLATE, custom-sample). Copied verbatim.
 *   2. **Reveal.js built-in themes** (reveal/vendor/themes/src/*.scss) —
 *      generated on the fly from the unminified Sass source into a clean
 *      `theme.css` of --r-* custom-property overrides.
 */
async function cloneBundledTheme() {
  const presentationsFolder = getPresentationsFolder();
  if (!presentationsFolder) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Pick a presentations folder first',
      detail: 'Use File → Open Presentations Folder... before copying a theme.',
    });
    return;
  }

  const presets = listBundledThemes();           // TEMPLATE, custom-sample, …
  const revealThemes = listRevealThemes();       // beige, black, dracula, …

  if (presets.length === 0 && revealThemes.length === 0) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'No built-in themes available',
    });
    return;
  }

  // Step 1: pick category.
  const categoryPick = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: [
      `Preset (${presets.length})`,
      `Reveal.js built-in (${revealThemes.length})`,
      'Cancel',
    ],
    cancelId: 2,
    defaultId: 0,
    message: 'Choose a theme source',
    detail:
      'Presets are the app\'s curated starting points (TEMPLATE, custom-sample).\n' +
      'Reveal.js built-ins are the upstream Reveal themes, generated into\n' +
      'editable --r-* CSS custom-property overrides (not minified).',
  });
  if (categoryPick.response === 2) return;
  const useReveal = categoryPick.response === 1;
  const options = useReveal ? revealThemes : presets;

  // Step 2: pick the specific theme. Electron message-box buttons have a
  // practical limit; we page if needed. For our 12-max case, one paging
  // round is enough.
  const BUTTONS_PER_PAGE = 8;
  let startIdx = 0;
  let chosen = null;
  while (chosen === null) {
    const slice = options.slice(startIdx, startIdx + BUTTONS_PER_PAGE);
    const hasMore = startIdx + BUTTONS_PER_PAGE < options.length;
    const hasPrev = startIdx > 0;
    const buttons = [...slice];
    if (hasMore) buttons.push('Next…');
    if (hasPrev) buttons.push('Previous…');
    buttons.push('Cancel');

    const pick = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons,
      cancelId: buttons.length - 1,
      defaultId: 0,
      message: useReveal ? 'Pick a Reveal.js theme' : 'Pick a preset theme',
      detail: `Showing ${startIdx + 1}–${startIdx + slice.length} of ${options.length}`,
    });
    const label = buttons[pick.response];
    if (label === 'Cancel') return;
    if (label === 'Next…') { startIdx += BUTTONS_PER_PAGE; continue; }
    if (label === 'Previous…') { startIdx = Math.max(0, startIdx - BUTTONS_PER_PAGE); continue; }
    chosen = label;
  }

  const dst = path.join(presentationsFolder, '_themes', chosen);

  if (fs.existsSync(dst)) {
    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Overwrite'],
      cancelId: 0,
      defaultId: 0,
      message: `${chosen} already exists in _themes/`,
      detail: 'Overwrite the existing folder?',
    });
    if (confirm.response !== 1) return;
    fs.rmSync(dst, { recursive: true, force: true });
  }

  try {
    if (useReveal) {
      generateThemeFromReveal(chosen, dst);
    } else {
      const src = path.join(app.getAppPath(), 'reveal', 'themes', chosen);
      copyDirectory(src, dst);
      // Presets other than TEMPLATE get the boilerplate appended so
      // every copied theme surfaces the same commented recipes
      // (layout, chrome, fragments, backgrounds). TEMPLATE already has
      // them verbatim.
      if (chosen !== 'TEMPLATE') {
        const boilerplate = readTemplateBoilerplate();
        if (boilerplate) {
          const cssPath = path.join(dst, 'theme.css');
          const existing = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
          if (!existing.includes('PowerPoint-style layout')) {
            fs.writeFileSync(cssPath, `${existing.trimEnd()}\n\n${boilerplate}`);
          }
        }
      }
    }
    invalidateUserThemeCache();
    await shell.openPath(dst);
  } catch (err) {
    await dialog.showErrorBox('Copy failed', String(err));
  }
}

/** Open the user's `_themes/` folder (creating it if missing). */
async function openUserThemesFolder() {
  const presentationsFolder = getPresentationsFolder();
  if (!presentationsFolder) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Pick a presentations folder first',
    });
    return;
  }
  const dir = path.join(presentationsFolder, '_themes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
}

/**
 * Run a theme.json object through the front-matter allowlist + validators
 * by rendering it to YAML-ish source and parsing it back. Reusing the
 * existing pipeline guarantees themes can't specify keys that deck
 * authors can't, or bypass value validation.
 *
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function sanitizeThemeObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const lines = ['---'];
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [sk, sv] of Object.entries(value)) {
        if (typeof sv === 'string' || typeof sv === 'number' || typeof sv === 'boolean') {
          lines.push(`  ${sk}: ${JSON.stringify(sv)}`);
        }
      }
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((x) => JSON.stringify(x)).join(', ')}]`);
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  lines.push('');
  const { frontMatter } = parseFrontMatter(lines.join('\n'));
  return frontMatter;
}

/**
 * Merge theme defaults into a deck's front-matter. Front-matter wins on
 * conflict (last-writer semantics). The `footer` key merges one level
 * deep so that a deck can override just one side.
 *
 * @param {Record<string, unknown>} themeValues
 * @param {Record<string, unknown>} frontMatter
 * @returns {Record<string, unknown>}
 */
function mergeTheme(themeValues, frontMatter) {
  const merged = { ...themeValues };
  for (const [key, val] of Object.entries(frontMatter)) {
    if (key === 'footer' && val && typeof val === 'object' && !Array.isArray(val)
        && merged.footer && typeof merged.footer === 'object' && !Array.isArray(merged.footer)) {
      merged.footer = { ...merged.footer, ...val };
    } else {
      merged[key] = val;
    }
  }
  return merged;
}

/**
 * Generate the HTML wrapper for a deck that ships only `deck.md`.
 * Parses front-matter, merges theme defaults if `theme:` is set, and
 * returns the rendered document as a text/html `Response`.
 *
 * @param {string} deckDir Absolute path to the deck folder.
 */
function generatedDeckResponse(deckDir) {
  const deckMdPath = path.join(deckDir, 'deck.md');
  const source = fs.readFileSync(deckMdPath, 'utf-8');
  const { frontMatter: deckFm, body } = parseFrontMatter(source);

  let frontMatter = deckFm;
  let themeCssHref = null;
  if (typeof deckFm.theme === 'string') {
    const theme = loadTheme(deckFm.theme);
    if (theme) {
      frontMatter = mergeTheme(theme.values, deckFm);
      themeCssHref = theme.cssHref;
    }
  }

  const html = renderDeckHtml({
    frontMatter,
    markdownBody: body,
    hasDeckJs: fs.existsSync(path.join(deckDir, 'deck.js')),
    hasDeckCss: fs.existsSync(path.join(deckDir, 'deck.css')),
    themeCssHref,
    themeName: typeof deckFm.theme === 'string' ? deckFm.theme : null,
  });
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Safely resolve `relative` against `baseDir`.
 * Returns the absolute path only when the resolved target stays inside
 * `baseDir`. Blocks traversal via `..` segments and absolute overrides
 * in the user-controlled portion of the URL.
 *
 * @param {string} baseDir Absolute base directory.
 * @param {string} relative The user-controlled relative path.
 * @returns {string|null} Absolute path within baseDir, or null if unsafe.
 */
function resolveWithinBase(baseDir, relative) {
  const resolved = path.resolve(baseDir, relative);
  const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (resolved !== baseDir && !resolved.startsWith(normalizedBase)) return null;
  return resolved;
}

/**
 * Install the custom `file://` protocol handler on the default session.
 * Call once, after `app.whenReady()`.
 *
 * Request routing order:
 *   1. `/reveal/<x>` → `<app>/reveal/<x>` (reveal.js, deck-init, vendor, CSS)
 *   2. `/plugin/<x>` → `<app>/reveal/plugin/<x>` (markdown, highlight, …)
 *   3. `<deck>/index.html` missing-but-deck.md-exists → synthesized HTML
 *   4. Anything else that exists on disk → served as-is
 *   5. Otherwise → 404
 */
function registerProtocolHandler() {
  const revealDir = path.join(app.getAppPath(), 'reveal');
  const pluginDir = path.join(revealDir, 'plugin');

  /**
   * Advanced escape hatch: if the user has a `_reveal/` folder inside
   * their presentations folder, files there override the bundled
   * `reveal/` and `reveal/plugin/` files. Unsupported — the user is
   * responsible for keeping their override compatible with deck-init
   * and SlideController. Only the file(s) they drop in are overridden;
   * missing files fall through to the bundled copy.
   */
  function userRevealOverride(relative) {
    const folder = getPresentationsFolder();
    if (!folder) return null;
    const overrideRoot = path.join(folder, '_reveal');
    if (!fs.existsSync(overrideRoot)) return null;
    const resolved = resolveWithinBase(overrideRoot, relative);
    if (!resolved) return null;
    if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) return resolved;
    return null;
  }

  session.defaultSession.protocol.handle('file', (request) => {
    const url = new URL(request.url);
    let filePath;
    try {
      filePath = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    // Intercept /reveal/* and /plugin/* → user's _reveal/ override first,
    // then the bundled reveal/ folder.
    const revealMatch = filePath.match(/\/reveal\/(.*)/);
    if (revealMatch) {
      const overridePath = userRevealOverride(revealMatch[1]);
      if (overridePath) return fileResponse(overridePath);
      const bundledPath = resolveWithinBase(revealDir, revealMatch[1]);
      if (bundledPath && fs.existsSync(bundledPath) && !fs.statSync(bundledPath).isDirectory()) {
        return fileResponse(bundledPath);
      }
    }
    const pluginMatch = filePath.match(/\/plugin\/(.*)/);
    if (pluginMatch) {
      // Plugins live under `_reveal/plugin/...` in the user override, so
      // prepend "plugin/" when checking the override root.
      const overridePath = userRevealOverride(path.join('plugin', pluginMatch[1]));
      if (overridePath) return fileResponse(overridePath);
      const bundledPath = resolveWithinBase(pluginDir, pluginMatch[1]);
      if (bundledPath && fs.existsSync(bundledPath) && !fs.statSync(bundledPath).isDirectory()) {
        return fileResponse(bundledPath);
      }
    }

    // Intercept /user-themes/<name>/<asset> → serve from the user's
    // _themes/<name>/ folder. Scoped to the active presentations folder.
    const userThemeMatch = filePath.match(/^\/user-themes\/([^/]+)\/(.+)/);
    if (userThemeMatch) {
      const themesRoot = userThemesDir();
      if (themesRoot) {
        const themeName = decodeURIComponent(userThemeMatch[1]);
        if (/^[a-zA-Z0-9_-]{1,64}$/.test(themeName)) {
          const themeDir = path.join(themesRoot, themeName);
          const resolved = resolveWithinBase(themeDir, userThemeMatch[2]);
          if (resolved && fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
            return fileResponse(resolved);
          }
        }
      }
    }

    // Generated deck wrapper: <deck>/index.html with deck.md sibling
    if (filePath.endsWith('/index.html')) {
      const deckDir = path.dirname(filePath);
      if (!fs.existsSync(filePath) && fs.existsSync(path.join(deckDir, 'deck.md'))) {
        return generatedDeckResponse(deckDir);
      }
    }

    // Default: serve file directly from disk (net.fetch would re-enter this handler)
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      return fileResponse(filePath);
    }

    return new Response('Not found', { status: 404 });
  });
}

// ── Thumbnail screenshot cache ──────────────────────────────
// On first request for a deck's thumbnail we open an invisible
// BrowserWindow, load the deck, wait for Reveal to be ready, capture the
// first slide, resize to 640px wide, and write a PNG under userData.
// Subsequent requests serve the cached PNG unless any deck source file
// has been modified since the capture.

/** Ensure the thumbnail cache dir exists; return its absolute path. */
function thumbnailCacheDir() {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Compute the on-disk PNG path for a deck's cached thumbnail.
 * Uses a URL-safe base64 of the folder path as the filename so colliding
 * deck names in different folders get distinct cache entries.
 */
function thumbnailCachePath(deckFolder) {
  const hash = Buffer.from(deckFolder).toString('base64').replace(/[/+=]/g, '_');
  return path.join(thumbnailCacheDir(), hash + '.png');
}

/**
 * Latest mtime across a deck's source files. Used to decide if a
 * cached thumbnail is stale. Covers top-level deck files plus
 * everything under `assets/` (images, SVGs, custom fonts etc.).
 *
 * Not included: the active theme's files, which live outside the
 * deck folder. Resolving the theme would mean parsing deck.md's
 * front-matter on every get-thumbnail call — not worth the cost
 * since the live-reload watcher rebuilds the PNG during authoring.
 *
 * @returns {number} ms since epoch, or 0 if no source files exist.
 */
function deckSourceMtime(deckFolder) {
  const candidates = ['deck.md', 'index.html', 'deck.js', 'deck.css'];
  let latest = 0;
  for (const name of candidates) {
    const p = path.join(deckFolder, name);
    if (fs.existsSync(p)) {
      latest = Math.max(latest, fs.statSync(p).mtimeMs);
    }
  }
  const assetsDir = path.join(deckFolder, 'assets');
  if (fs.existsSync(assetsDir)) {
    latest = Math.max(latest, latestMtimeInTree(assetsDir));
  }
  return latest;
}

/**
 * Walk a directory tree and return the newest mtime across all files.
 * Bounded so a pathological tree (symlink loop, huge unrelated dir)
 * can't make thumbnail checks expensive.
 */
function latestMtimeInTree(root, budget = 500) {
  let latest = 0;
  let visited = 0;
  const stack = [root];
  while (stack.length && visited < budget) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      if (visited >= budget) break;
      visited++;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.isFile()) {
        try { latest = Math.max(latest, fs.statSync(p).mtimeMs); } catch {}
      }
    }
  }
  return latest;
}

/**
 * Poll a webContents until `Reveal.isReady()` returns true, or time out.
 * We capture anyway on timeout — a partial screenshot is more useful than
 * no thumbnail at all.
 *
 * @param {Electron.WebContents} webContents
 * @param {number} [timeoutMs=3000]
 */
async function waitForRevealReady(webContents, timeoutMs = 3000) {
  const start = Date.now();
  const isReadyExpr = 'typeof Reveal !== "undefined" && Reveal.isReady && Reveal.isReady()';
  while (Date.now() - start < timeoutMs) {
    try {
      if (await webContents.executeJavaScript(isReadyExpr)) break;
    } catch {
      // executeJavaScript throws if the page is mid-navigation; retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Even after Reveal is ready, webfonts (Google Fonts loaded via theme.json
  // `font:` key) may still be downloading. Capturing mid-font-load produces
  // a blank thumbnail because text hasn't painted yet. document.fonts.ready
  // resolves once every loaded font is decoded and rendering.
  try {
    await webContents.executeJavaScript(
      'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true'
    );
  } catch {
    // ignore — at worst we capture without the final font
  }
}

/**
 * Render a deck into an offscreen window and write a PNG thumbnail to
 * the cache. The returned promise resolves with the cache path.
 *
 * Caller guarantees only one capture runs per deck at a time (see the
 * `thumbnailJobs` map in the IPC handler).
 *
 * @param {string} deckFolder Absolute path to the deck's folder.
 * @returns {Promise<string>} Path to the written PNG.
 */
/**
 * Export the deck at `deckFolder` as a self-contained folder. Copies
 * the deck's own files plus the bundled reveal/plugin/theme assets
 * the deck references, and rewrites absolute app-served paths
 * (`/reveal/...`, `/plugin/...`, `/user-themes/...`) to relative ones
 * so the output runs in any browser without the app.
 *
 * @param {string} deckFolder Absolute path to the deck folder.
 * @returns {Promise<string|null>} Path to the export folder, or null if cancelled/failed.
 */
async function exportDeckStandalone(deckFolder) {
  if (!deckFolder) return null;

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose export destination folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths.length) return null;

  const deckName = path.basename(deckFolder);
  const outDir = path.join(filePaths[0], deckName);

  if (fs.existsSync(outDir)) {
    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Overwrite'],
      cancelId: 0,
      defaultId: 0,
      message: `${deckName} already exists in the destination`,
      detail: `Replace ${outDir} with the new export?`,
    });
    if (confirm.response !== 1) return null;
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  fs.mkdirSync(outDir, { recursive: true });

  // Copy the deck folder itself.
  for (const entry of fs.readdirSync(deckFolder, { withFileTypes: true })) {
    // Skip index.html if present — we regenerate it with rewritten paths.
    if (entry.name === 'index.html') continue;
    const src = path.join(deckFolder, entry.name);
    const dst = path.join(outDir, entry.name);
    fs.cpSync(src, dst, { recursive: true });
  }

  // Copy the app's reveal/ core (reveal.js, reveal.css, reset.css, deck-init.js)
  // plus all plugins we reference. We skip reveal/themes/ and reveal/vendor/themes/
  // unless the deck actually uses them.
  const appRevealDir = path.join(app.getAppPath(), 'reveal');
  const outRevealDir = path.join(outDir, 'reveal');
  fs.mkdirSync(outRevealDir, { recursive: true });
  for (const file of ['reveal.js', 'reveal.css', 'reset.css', 'deck-init.js']) {
    const src = path.join(appRevealDir, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outRevealDir, file));
  }

  // Copy plugin/ (markdown, highlight, notes, zoom, search, slide-controller).
  const outPluginDir = path.join(outDir, 'plugin');
  fs.cpSync(path.join(appRevealDir, 'plugin'), outPluginDir, { recursive: true });

  // Parse front-matter to see what theme / vendor scripts the deck uses.
  const deckMd = path.join(deckFolder, 'deck.md');
  let frontMatter = {};
  let body = '';
  if (fs.existsSync(deckMd)) {
    const parsed = parseFrontMatter(fs.readFileSync(deckMd, 'utf-8'));
    frontMatter = parsed.frontMatter;
    body = parsed.body;
  }

  // Copy the active theme folder if any. Mirrors the loader's lookup order:
  // user _themes first, then bundled reveal/themes, then reveal vendor theme CSS.
  let themeCssHrefExported = null;
  let frontMatterMerged = frontMatter;
  if (typeof frontMatter.theme === 'string') {
    const themeName = frontMatter.theme;
    const userThemeDir = userThemesDir() ? path.join(userThemesDir(), themeName) : null;
    const bundledThemeDir = path.join(appRevealDir, 'themes', themeName);
    const revealThemeCss = path.join(appRevealDir, 'vendor', 'themes', `${themeName}.css`);

    let srcThemeDir = null;
    if (userThemeDir && fs.existsSync(path.join(userThemeDir, 'theme.json'))) {
      srcThemeDir = userThemeDir;
    } else if (fs.existsSync(path.join(bundledThemeDir, 'theme.json'))) {
      srcThemeDir = bundledThemeDir;
    }

    if (srcThemeDir) {
      const outThemeDir = path.join(outDir, 'themes', themeName);
      fs.cpSync(srcThemeDir, outThemeDir, { recursive: true });
      if (fs.existsSync(path.join(outThemeDir, 'theme.css'))) {
        themeCssHrefExported = `themes/${themeName}/theme.css`;
      }
      // Merge theme.json values into front-matter (deck still wins) so
      // the generated HTML has the final theme baked in with relative
      // paths.
      try {
        const rawTheme = JSON.parse(fs.readFileSync(path.join(srcThemeDir, 'theme.json'), 'utf-8'));
        const themeValues = sanitizeThemeObject(rawTheme);
        if (typeof themeValues.logo === 'string' && !/^(https?:\/\/|\/)/.test(themeValues.logo)) {
          themeValues.logo = `themes/${themeName}/${themeValues.logo}`;
        }
        frontMatterMerged = mergeTheme(themeValues, frontMatter);
      } catch { /* ignore */ }
    } else if (fs.existsSync(revealThemeCss)) {
      // Reveal built-in theme — just copy the single CSS file.
      const outVendorThemes = path.join(outDir, 'reveal', 'vendor', 'themes');
      fs.mkdirSync(outVendorThemes, { recursive: true });
      fs.copyFileSync(revealThemeCss, path.join(outVendorThemes, `${themeName}.css`));
    }
  }

  // Copy referenced /reveal/vendor/* scripts (d3, anime, etc.)
  const scripts = Array.isArray(frontMatterMerged.scripts) ? frontMatterMerged.scripts : [];
  const styles = Array.isArray(frontMatterMerged.styles) ? frontMatterMerged.styles : [];
  for (const list of [scripts, styles]) {
    for (const entry of list) {
      if (typeof entry !== 'string') continue;
      // App-served local paths: /reveal/..., /plugin/..., /user-themes/...
      const m = entry.match(/^\/(reveal|plugin|user-themes)\/(.+)$/);
      if (!m) continue;
      let srcPath, dstRel;
      if (m[1] === 'reveal') {
        srcPath = path.join(appRevealDir, m[2]);
        dstRel = path.join('reveal', m[2]);
      } else if (m[1] === 'plugin') {
        srcPath = path.join(appRevealDir, 'plugin', m[2]);
        dstRel = path.join('plugin', m[2]);
      } else if (m[1] === 'user-themes') {
        if (!userThemesDir()) continue;
        srcPath = path.join(userThemesDir(), m[2]);
        dstRel = path.join('themes', m[2]);
      }
      if (!srcPath || !fs.existsSync(srcPath)) continue;
      const dstPath = path.join(outDir, dstRel);
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
    }
  }

  // Generate index.html using the same template as runtime, then rewrite
  // absolute app-served paths to relative ones.
  let html = renderDeckHtml({
    frontMatter: frontMatterMerged,
    markdownBody: body,
    hasDeckJs: fs.existsSync(path.join(deckFolder, 'deck.js')),
    hasDeckCss: fs.existsSync(path.join(deckFolder, 'deck.css')),
    themeCssHref: themeCssHrefExported,
    themeName: typeof frontMatter.theme === 'string' ? frontMatter.theme : null,
  });
  // Path rewrites. Order matters: /user-themes/<name>/ → themes/<name>/
  // (we mirrored it one level up), then plain /reveal and /plugin → relative.
  html = html.replace(/\/user-themes\//g, 'themes/');
  html = html.replace(/"\/reveal\//g, '"reveal/');
  html = html.replace(/"\/plugin\//g, '"plugin/');

  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  return outDir;
}

/**
 * Export the deck at `deckFolder` as a PDF via Reveal's built-in
 * print-pdf mode. Shows a save dialog, spins up a hidden BrowserWindow
 * at the deck's canvas dimensions, loads the deck with `?print-pdf`,
 * waits for Reveal to be ready, and calls webContents.printToPDF.
 *
 * The output preserves each slide as a single page. Fragments come out
 * on separate pages when the deck has `pdfSeparateFragments: true`
 * (default) in its front-matter.
 *
 * @param {string} deckFolder Absolute path to the deck folder.
 * @returns {Promise<string|null>} Path to the saved PDF, or null if cancelled/failed.
 */
async function exportDeckPdf(deckFolder) {
  if (!deckFolder) return null;

  // Suggest a filename based on the folder name.
  const defaultName = path.basename(deckFolder) + '.pdf';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export deck as PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;

  // Parse deck front-matter to determine canvas dimensions.
  let width = 1920;
  let height = 1080;
  const deckMd = path.join(deckFolder, 'deck.md');
  if (fs.existsSync(deckMd)) {
    try {
      const { frontMatter } = parseFrontMatter(fs.readFileSync(deckMd, 'utf-8'));
      if (typeof frontMatter.width === 'number') width = frontMatter.width;
      if (typeof frontMatter.height === 'number') height = frontMatter.height;
    } catch { /* ignore, use defaults */ }
  }

  const indexUrl = 'file://' + path.join(deckFolder, 'index.html') + '?print-pdf';
  const win = new BrowserWindow({
    width, height,
    show: false,
    webPreferences: DECK_WEB_PREFERENCES,
  });

  try {
    await win.loadURL(indexUrl);
    await waitForRevealReady(win.webContents, 10000);
    // Give Reveal a beat to lay out the print-pdf mode — in this mode it
    // reflows all slides into a single scroll column, which is slower
    // than normal rendering.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Use the deck's declared canvas as the page size (convert pixels →
    // microns: 1px @ 96dpi = 264.5833 microns). Reveal's print-pdf CSS
    // uses @page with slide dimensions, so matching the page size keeps
    // each slide on one page without scaling artifacts.
    const PX_TO_MICRONS = 264.5833;
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: width > height,
      pageSize: {
        width: Math.round(width * PX_TO_MICRONS),
        height: Math.round(height * PX_TO_MICRONS),
      },
      margins: { marginType: 'none' },
    });
    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
  } finally {
    win.destroy();
  }
}

async function captureDeckThumbnail(deckFolder) {
  const indexUrl = 'file://' + path.join(deckFolder, 'index.html');
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: DECK_WEB_PREFERENCES,
  });

  try {
    await win.loadURL(indexUrl);
    await waitForRevealReady(win.webContents);
    const image = await win.webContents.capturePage();
    const buffer = image.resize({ width: 640 }).toPNG();
    const cachePath = thumbnailCachePath(deckFolder);
    fs.writeFileSync(cachePath, buffer);
    return cachePath;
  } finally {
    win.destroy();
  }
}

/**
 * In-flight thumbnail capture jobs, keyed by deck folder. Prevents
 * duplicate captures when the renderer fires parallel get-thumbnail
 * requests on first home-screen render.
 *
 * @type {Map<string, Promise<string|null>>}
 */
const thumbnailJobs = new Map();

// ── IPC Handlers ────────────────────────────────────────────
// The renderer talks to the main process through `window.electronAPI`
// (wired up in preload.js). Every handler below maps 1:1 to a method
// on that surface.

/**
 * Register all `ipcMain.handle` endpoints. Call once during app startup.
 *
 * Channels:
 *   - `get-decks`      → Deck[]    list decks in the active folder
 *   - `get-config`     → { presentationsFolder }
 *   - `open-folder`    → string|null  native folder picker
 *   - `get-thumbnail`  → { path }  cached screenshot for a deck
 */
function registerIPC() {
  /** Subfolders to skip when scanning for decks (assets, git, themes, overrides). */
  const SKIP_DIRS = new Set(['common', 'images', 'dist', 'node_modules', '.git', '_themes', '_reveal']);

  /**
   * If `deckFolder` contains `deck.md` or `index.html`, return a Deck
   * descriptor for the renderer. Otherwise null.
   *
   * @typedef {Object} Deck
   * @property {string} name     Display name (folder name).
   * @property {string} path     `file://` URL to index.html.
   * @property {string} folder   Absolute path to the deck folder.
   * @property {'html'|'markdown'} source Which source file was found first.
   */
  function describeDeck(deckFolder, displayName) {
    const hasIndex = fs.existsSync(path.join(deckFolder, 'index.html'));
    const hasDeckMd = fs.existsSync(path.join(deckFolder, 'deck.md'));
    if (!hasIndex && !hasDeckMd) return null;
    return {
      name: displayName,
      path: 'file://' + path.join(deckFolder, 'index.html'),
      folder: deckFolder,
      source: hasIndex ? 'html' : 'markdown',
    };
  }

  // Returns all decks in the active folder. Handles both modes:
  //   - Folder IS a deck         → [that one deck]
  //   - Folder CONTAINS decks    → one Deck per valid subfolder
  ipcMain.handle('get-decks', () => {
    const folder = getPresentationsFolder();
    if (!folder || !fs.existsSync(folder)) return [];

    // If the selected folder is itself a deck, return just that one.
    const self = describeDeck(folder, path.basename(folder));
    if (self) return [self];

    // Otherwise treat it as a folder of decks.
    const decks = [];
    for (const entry of fs.readdirSync(folder)) {
      if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
      const entryPath = path.join(folder, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;
      const deck = describeDeck(entryPath, entry);
      if (deck) decks.push(deck);
    }
    return decks;
  });

  // Returns persisted config — active folder + whether it's trusted.
  ipcMain.handle('get-config', () => {
    return {
      presentationsFolder: getPresentationsFolder(),
      trustedFolder: isTrustedFolder(),
    };
  });

  ipcMain.handle('set-folder-trusted', (_event, trusted) => {
    const folder = getPresentationsFolder();
    if (!folder) return false;
    setFolderTrusted(folder, !!trusted);
    return isTrustedFolder();
  });

  // Show the native folder picker. Resolves to the chosen path or null.
  ipcMain.handle('open-folder', () => openFolderDialog());

  /**
   * Return the cached thumbnail for a deck, capturing it first if the
   * cache is empty or stale. Waits for any in-flight capture so we never
   * launch two offscreen windows for the same deck.
   *
   * @returns {Promise<{ path: string|null }>}
   */
  ipcMain.handle('get-thumbnail', async (_event, deckFolder) => {
    if (!deckFolder) return { path: null };
    const cachePath = thumbnailCachePath(deckFolder);
    const sourceMtime = deckSourceMtime(deckFolder);
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).mtimeMs >= sourceMtime) {
      return { path: cachePath };
    }
    if (!thumbnailJobs.has(deckFolder)) {
      const job = captureDeckThumbnail(deckFolder)
        .catch(() => null)
        .finally(() => thumbnailJobs.delete(deckFolder));
      thumbnailJobs.set(deckFolder, job);
    }
    await thumbnailJobs.get(deckFolder);
    return { path: fs.existsSync(cachePath) ? cachePath : null };
  });

  // ── Deck file watcher (live reload) ────────────────────────
  // Only one watcher is active at a time — the one tracking whatever
  // deck is currently open in the viewer. Switching decks calls
  // watch-deck again which tears down the old watcher first. We also
  // track the active deck folder here so menu actions (PDF export,
  // standalone export) can target it without needing renderer state.

  /** @type {string | null} */
  let activeDeckFolder = null;

  /** @type {fs.FSWatcher | null} */
  let activeWatcher = null;
  /** @type {NodeJS.Timeout | null} */
  let debounceTimer = null;
  const DEBOUNCE_MS = 200;

  function teardownWatcher() {
    if (activeWatcher) {
      try { activeWatcher.close(); } catch { /* already closed */ }
      activeWatcher = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function notifyDeckChanged() {
    // Skip if the main window is gone (closed / being destroyed).
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('deck-changed');
  }

  ipcMain.handle('watch-deck', (_event, deckFolder) => {
    teardownWatcher();
    activeDeckFolder = null;
    if (!deckFolder || !fs.existsSync(deckFolder) || !fs.statSync(deckFolder).isDirectory()) return;
    activeDeckFolder = deckFolder;
    try {
      activeWatcher = fs.watch(deckFolder, { recursive: true }, (_eventType, filename) => {
        // Ignore editor swap / partial-write files.
        if (filename && /(\.swp|\.swx|~$|\.tmp$|\.lock$)/.test(filename)) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          notifyDeckChanged();
        }, DEBOUNCE_MS);
      });
    } catch (err) {
      console.warn('[watch-deck] failed for', deckFolder, err.message);
    }
  });

  ipcMain.handle('unwatch-deck', () => {
    teardownWatcher();
    activeDeckFolder = null;
  });

  // Expose the active deck folder for menu actions.
  getActiveDeckFolder = () => activeDeckFolder;
}

/**
 * Set inside `registerIPC` so menu actions (which live outside that
 * closure) can ask for the currently-open deck folder.
 * @type {() => (string | null)}
 */
let getActiveDeckFolder = () => null;

// ── Auto-update (packaged builds only) ──────────────────────
// electron-updater checks the configured update feed on startup and
// downloads updates in the background. Disabled in dev (`npm start`)
// and in non-packaged builds so developer iteration isn't hijacked.

async function initAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: `Update ${info.version} ready`,
        detail: 'Restart the app to install the update.',
      }).then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
    });
    autoUpdater.on('error', (err) => {
      console.warn('[autoUpdater]', err.message);
    });
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[autoUpdater] init failed:', err.message);
  }
}

// ── App lifecycle ───────────────────────────────────────────

app.whenReady().then(() => {
  registerProtocolHandler();
  registerIPC();
  buildMenu();
  createWindow();
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
