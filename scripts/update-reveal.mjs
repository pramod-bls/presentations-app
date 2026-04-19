#!/usr/bin/env node
/**
 * Update the bundled Reveal.js from the npm registry.
 *
 * Usage:
 *   node scripts/update-reveal.mjs            # install `latest`
 *   node scripts/update-reveal.mjs 6.0.2      # install a specific version
 *   node scripts/update-reveal.mjs --dry-run  # report-only, no file changes
 *
 * What it touches:
 *   - reveal/reveal.js          ← dist/reveal.js
 *   - reveal/reveal.css         ← dist/reveal.css
 *   - reveal/reset.css          ← dist/reset.css
 *   - reveal/plugin/<name>.js   ← dist/plugin/<name>/plugin.js (or .js)
 *   - reveal/plugin/highlight/  ← dist/plugin/highlight/ (monokai etc.)
 *   - reveal/vendor/themes/*.css ← dist/theme/*.css (excludes *-contrast)
 *
 * What it NEVER touches:
 *   - reveal/plugin/slide-controller/  (our custom plugin)
 *   - reveal/deck-init.js              (our shared initializer)
 *   - reveal/themes/                   (our theme presets)
 *   - reveal/vendor/d3.min.js, anime.min.js (our vendored libs)
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REVEAL_DIR = join(PROJECT_ROOT, 'reveal');
const PLUGIN_DIR = join(REVEAL_DIR, 'plugin');
const VENDOR_THEMES = join(REVEAL_DIR, 'vendor', 'themes');

// Files we overwrite from the tarball. Keyed by destination relative to REVEAL_DIR.
const CORE_FILES = {
  'reveal.js': 'dist/reveal.js',
  'reveal.css': 'dist/reveal.css',
  'reset.css': 'dist/reset.css',
};

// Plugins we upgrade. Source paths are tried in order until one exists.
// (Reveal 6 layout puts each plugin as a flat file under dist/plugin/;
// older layouts used a per-plugin subfolder.)
const PLUGIN_FILES = {
  'plugin/markdown.js':  ['dist/plugin/markdown.js',  'dist/plugin/markdown/plugin.js',  'dist/plugin/markdown/markdown.js'],
  'plugin/highlight.js': ['dist/plugin/highlight.js', 'dist/plugin/highlight/plugin.js', 'dist/plugin/highlight/highlight.js'],
  'plugin/notes.js':     ['dist/plugin/notes.js',     'dist/plugin/notes/plugin.js',     'dist/plugin/notes/notes.js'],
  'plugin/zoom.js':      ['dist/plugin/zoom.js',      'dist/plugin/zoom/plugin.js',      'dist/plugin/zoom/zoom.js'],
  'plugin/search.js':    ['dist/plugin/search.js',    'dist/plugin/search/plugin.js',    'dist/plugin/search/search.js'],
};

const HIGHLIGHT_THEMES_SRC_DIR = 'dist/plugin/highlight'; // monokai.css, zenburn.css, etc.
const THEMES_SRC_DIR = 'dist/theme';                      // black.css, white.css, etc.

// Themes we skip (too large due to embedded fonts).
const SKIP_THEMES = new Set(['black-contrast.css', 'white-contrast.css']);

// Sass sources for each theme (fetched from GitHub since npm tarball
// only ships dist/). Mirrors css/theme/*.scss upstream. Kept for
// reference as users author their own themes.
const SASS_THEMES = [
  'beige', 'black', 'blood', 'dracula', 'league', 'moon',
  'night', 'serif', 'simple', 'sky', 'solarized', 'white',
];
const SASS_TEMPLATE_PARTIALS = [
  'settings.scss', 'mixins.scss', 'theme.scss', 'exposer.scss',
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const targetVersion = args.find((a) => !a.startsWith('--')) || 'latest';

function log(msg) { console.log(msg); }
function warn(msg) { console.warn('\x1b[33m' + msg + '\x1b[0m'); }
function die(msg) { console.error('\x1b[31m' + msg + '\x1b[0m'); process.exit(1); }

function run(cmd, cwd = PROJECT_ROOT) {
  return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function detectCurrentVersion() {
  try {
    const src = readFileSync(join(REVEAL_DIR, 'reveal.js'), 'utf-8');
    const match = src.match(/\b(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

function checkCleanGit() {
  try {
    const status = run('git status --porcelain -- reveal/ 2>/dev/null');
    if (status.trim()) {
      warn('Uncommitted changes under reveal/:');
      console.error(status);
      warn('Commit or stash these before upgrading so the diff is reviewable.');
      warn('Re-run with --force to override.\n');
      if (!args.includes('--force')) process.exit(1);
    }
  } catch {
    // not a git repo; skip
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) die(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) die(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Non-fatal variant — returns null on any failure.
async function tryFetchBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function resolveTarball(version) {
  const meta = await fetchJson(`https://registry.npmjs.org/reveal.js/${encodeURIComponent(version)}`);
  if (!meta.dist || !meta.dist.tarball) die(`No tarball in registry metadata for reveal.js@${version}`);
  return { url: meta.dist.tarball, version: meta.version };
}

function extractTarball(buffer) {
  const dir = mkdtempSync(join(tmpdir(), 'reveal-update-'));
  const tarPath = join(dir, 'reveal.tgz');
  writeFileSync(tarPath, buffer);
  run(`tar -xzf reveal.tgz -C ${dir}`, dir);
  // npm tarballs extract into a `package/` directory.
  return join(dir, 'package');
}

function copyIfExists(src, dst) {
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dst), { recursive: true });
  if (!DRY_RUN) copyFileSync(src, dst);
  return true;
}

function copyDir(src, dst, filter = () => true) {
  if (!existsSync(src)) return 0;
  if (!DRY_RUN) mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!filter(entry.name)) continue;
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) count += copyDir(s, d, filter);
    else if (entry.isFile()) {
      if (!DRY_RUN) copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

async function main() {
  checkCleanGit();

  const currentVersion = detectCurrentVersion();
  log(`Current Reveal.js version: ${currentVersion}`);

  log(`Resolving reveal.js@${targetVersion} from npm…`);
  const { url, version: resolvedVersion } = await resolveTarball(targetVersion);
  log(`Target version: ${resolvedVersion}`);
  log(`Tarball:        ${url}`);

  if (resolvedVersion === currentVersion && !args.includes('--force')) {
    log('\nAlready up to date. Use --force to re-install the same version.');
    return;
  }

  log('\nDownloading tarball…');
  const buf = await fetchBuffer(url);
  log(`  ${(buf.length / 1024).toFixed(1)} KB`);

  log('Extracting…');
  const pkgDir = extractTarball(buf);

  const summary = { core: [], plugins: [], highlightThemes: 0, themes: 0, sassSources: 0, missing: [] };

  // Core files
  for (const [dst, srcRel] of Object.entries(CORE_FILES)) {
    const src = join(pkgDir, srcRel);
    const target = join(REVEAL_DIR, dst);
    if (copyIfExists(src, target)) summary.core.push(dst);
    else summary.missing.push(`core: ${srcRel}`);
  }

  // Plugins (try each candidate source path)
  for (const [dst, candidates] of Object.entries(PLUGIN_FILES)) {
    const target = join(REVEAL_DIR, dst);
    let copied = false;
    for (const srcRel of candidates) {
      const src = join(pkgDir, srcRel);
      if (copyIfExists(src, target)) {
        summary.plugins.push(dst);
        copied = true;
        break;
      }
    }
    if (!copied) summary.missing.push(`plugin: ${dst}`);
  }

  // Highlight themes (CSS files inside dist/plugin/highlight)
  const highlightSrc = join(pkgDir, HIGHLIGHT_THEMES_SRC_DIR);
  if (existsSync(highlightSrc)) {
    const highlightDst = join(PLUGIN_DIR, 'highlight');
    summary.highlightThemes = copyDir(highlightSrc, highlightDst, (name) => name.endsWith('.css'));
  }

  // Reveal built-in themes → vendor/themes
  const themesSrc = join(pkgDir, THEMES_SRC_DIR);
  if (existsSync(themesSrc)) {
    summary.themes = copyDir(themesSrc, VENDOR_THEMES, (name) =>
      name.endsWith('.css') && !SKIP_THEMES.has(name)
    );
  }

  // Sass sources → vendor/themes/src/ (GitHub raw, not in npm tarball).
  // Kept as reference material for users authoring custom themes.
  const sassDst = join(VENDOR_THEMES, 'src');
  const sassTemplateDst = join(sassDst, 'template');
  if (!DRY_RUN) {
    mkdirSync(sassDst, { recursive: true });
    mkdirSync(sassTemplateDst, { recursive: true });
  }
  const rawBase = `https://raw.githubusercontent.com/hakimel/reveal.js/${resolvedVersion}/css/theme`;
  for (const name of SASS_THEMES) {
    const src = await tryFetchBuffer(`${rawBase}/${name}.scss`);
    if (src) {
      if (!DRY_RUN) writeFileSync(join(sassDst, `${name}.scss`), src);
      summary.sassSources++;
    }
  }
  for (const partial of SASS_TEMPLATE_PARTIALS) {
    const src = await tryFetchBuffer(`${rawBase}/template/${partial}`);
    if (src) {
      if (!DRY_RUN) writeFileSync(join(sassTemplateDst, partial), src);
      summary.sassSources++;
    }
  }
  const readme = await tryFetchBuffer(`${rawBase}/README.md`);
  if (readme && !DRY_RUN) writeFileSync(join(sassDst, 'README.md'), readme);

  // Cleanup
  if (!DRY_RUN) rmSync(dirname(pkgDir), { recursive: true, force: true });

  // Report
  log('\n' + (DRY_RUN ? '─── DRY RUN — no files written ───' : '─── Update complete ───'));
  log(`${currentVersion} → ${resolvedVersion}`);
  log(`Core files:        ${summary.core.length} updated`);
  log(`Plugins:           ${summary.plugins.length} updated`);
  log(`Highlight themes:  ${summary.highlightThemes} files`);
  log(`Reveal themes:     ${summary.themes} files (skipped ${[...SKIP_THEMES].join(', ')})`);
  log(`Sass sources:      ${summary.sassSources} files (for custom-theme authoring)`);
  if (summary.missing.length) {
    warn(`\nSome files were not found in the tarball:\n  - ${summary.missing.join('\n  - ')}`);
    warn('These paths may have moved upstream. Adjust CORE_FILES / PLUGIN_FILES in this script.');
  }
  log('\nNext steps:');
  log('  1. git diff reveal/     # review the upgrade');
  log('  2. npm start            # smoke-test a deck');
  log('  3. git commit           # lock it in');
}

main().catch((err) => die(err.stack || err.message));
