/**
 * Home-screen renderer.
 *
 * Runs in the main BrowserWindow. Responsible for:
 *   - Showing the welcome screen if no presentations folder is configured.
 *   - Rendering a grid of deck cards (each with a cached thumbnail).
 *   - Mounting a sandboxed `<iframe>` viewer over the grid when a card is
 *     clicked — deck JS runs inside that iframe, isolated from the host.
 *
 * Talks to the main process through `window.electronAPI`, defined in
 * preload.js.
 */
import './index.css';

/** Turn a folder name like `my_intro-deck` into `My Intro Deck`. */
function formatName(name) {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render the welcome screen (shown when no presentations folder is set). */
function showWelcome() {
  const content = document.getElementById('content');
  content.innerHTML =
    '<div class="welcome">' +
    '<p>Open a presentation to get started.</p>' +
    '<p style="color:#666;font-size:0.85em;">Pick either a single deck folder (contains <code>deck.md</code> or <code>index.html</code>) ' +
    'or a parent folder whose subfolders are decks.</p>' +
    '<button id="open-btn">Open Folder</button>' +
    '</div>';
  document.getElementById('open-btn').addEventListener('click', () => {
    window.electronAPI.openFolder().then((folder) => {
      if (folder) loadDecks();
    });
  });
}

/**
 * Render the "currently viewing: /path" bar with a Change button.
 * Called before renderDecks when a folder is configured.
 */
function showFolderBar(folderPath) {
  document.querySelectorAll('.folder-bar').forEach((el) => el.remove());

  const bar = document.createElement('div');
  bar.className = 'folder-bar';
  bar.innerHTML = '<span class="path">' + folderPath + '</span>' +
    '<button id="change-btn">Change</button>';
  const h1 = document.querySelector('h1');
  h1.parentNode.insertBefore(bar, h1.nextSibling);

  document.getElementById('change-btn').addEventListener('click', () => {
    window.electronAPI.openFolder().then((folder) => {
      if (folder) loadDecks();
    });
  });
}

/**
 * Mount a fullscreen viewer overlay containing the deck inside a sandboxed
 * iframe. `allow-scripts` without `allow-same-origin` is the core of the
 * untrusted-deck isolation model (see ARCHITECTURE.md → Security).
 *
 * While the viewer is open, the main process watches the deck folder and
 * fires a `deck-changed` event on any file change; the iframe is then
 * reloaded with a cache-busting query so the protocol handler re-reads
 * from disk. Closing the viewer tears down the watcher.
 *
 * @param {string} deckPath `file://` URL to the deck's (possibly generated)
 *   index.html.
 * @param {string} deckName Display name — set on the iframe `title` for a11y.
 * @param {string} [deckFolder] Absolute path to the deck folder; enables
 *   live reload when provided.
 */
function openDeckViewer(deckPath, deckName, deckFolder) {
  const existing = document.getElementById('deck-viewer');
  if (existing) existing.remove();

  const viewer = document.createElement('div');
  viewer.id = 'deck-viewer';
  viewer.className = 'deck-viewer';

  const iframe = document.createElement('iframe');
  iframe.src = deckPath;
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('title', deckName);
  iframe.setAttribute('allowfullscreen', '');
  iframe.addEventListener('load', () => iframe.focus());

  // Flash indicator during live reload
  const reloadIndicator = document.createElement('div');
  reloadIndicator.className = 'deck-reload-indicator';
  reloadIndicator.textContent = 'Reloaded';

  // Live-reload wiring. Debounced via the main process; we also pace
  // consecutive reloads here so a burst of file changes can't pin the
  // iframe in a permanent load loop.
  let unsubscribe = null;
  let lastReload = 0;
  const MIN_RELOAD_GAP_MS = 300;
  if (deckFolder && window.electronAPI.watchDeck) {
    window.electronAPI.watchDeck(deckFolder);
    unsubscribe = window.electronAPI.onDeckChanged(() => {
      const now = Date.now();
      if (now - lastReload < MIN_RELOAD_GAP_MS) return;
      lastReload = now;
      // Cache-bust the URL so the protocol handler re-renders from disk.
      // The deck iframe is sandboxed (null origin) so we can't read the
      // inner location.hash directly; rely on Reveal's `hash: true` +
      // URL-based deep link behavior and just preserve whatever hash
      // was on the src the last time we set it.
      const url = new URL(iframe.src);
      url.searchParams.set('_r', String(now));
      iframe.src = url.toString();
      reloadIndicator.classList.add('visible');
      setTimeout(() => reloadIndicator.classList.remove('visible'), 800);
    });
  }

  const homeBtn = document.createElement('button');
  homeBtn.className = 'deck-viewer-home';
  homeBtn.textContent = '⬅ Home';
  homeBtn.addEventListener('click', () => {
    if (unsubscribe) unsubscribe();
    if (window.electronAPI.unwatchDeck) window.electronAPI.unwatchDeck();
    viewer.remove();
  });

  viewer.appendChild(iframe);
  viewer.appendChild(homeBtn);
  viewer.appendChild(reloadIndicator);
  document.body.appendChild(viewer);
  iframe.focus();
}

/**
 * Ask the main process for a deck thumbnail PNG and fade it in over
 * the placeholder. Silent no-op if the capture fails.
 *
 * @param {HTMLElement} thumb The card's `.thumbnail` container.
 * @param {string} deckFolder Absolute path to the deck folder.
 */
async function loadThumbnail(thumb, deckFolder) {
  if (!deckFolder) return;
  const result = await window.electronAPI.getThumbnail(deckFolder);
  if (!result || !result.path) return;
  const img = document.createElement('img');
  img.className = 'thumbnail-img';
  img.src = 'file://' + result.path + '?t=' + Date.now();
  img.alt = '';
  img.addEventListener('load', () => {
    const placeholder = thumb.querySelector('.thumbnail-placeholder');
    if (placeholder) placeholder.remove();
  });
  thumb.appendChild(img);
}

/**
 * Render the deck grid, attaching click handlers and kicking off
 * async thumbnail loads for each card.
 *
 * @param {Array<{ name: string, path: string, folder: string }>} decks
 */
function renderDecks(decks) {
  const content = document.getElementById('content');
  if (decks.length === 0) {
    content.innerHTML =
      '<div class="loading">No presentations found.<br>' +
      'Pick either a deck folder (contains <code>deck.md</code> or <code>index.html</code>) ' +
      'or a folder whose subfolders are decks.</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  decks.forEach((deck) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', () => openDeckViewer(deck.path, deck.name, deck.folder));

    const thumb = document.createElement('div');
    thumb.className = 'thumbnail';

    const placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';
    placeholder.textContent = formatName(deck.name);
    thumb.appendChild(placeholder);

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = formatName(deck.name);

    card.appendChild(thumb);
    card.appendChild(title);
    grid.appendChild(card);

    loadThumbnail(thumb, deck.folder);
  });

  content.innerHTML = '';
  content.appendChild(grid);
}

/**
 * Top-level bootstrap: fetch config, decide welcome vs grid, then render.
 * Runs automatically on module load (see bottom of file).
 */
async function loadDecks() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Loading presentations...</div>';

  try {
    const config = await window.electronAPI.getConfig();
    if (!config.presentationsFolder) {
      showWelcome();
      return;
    }

    showFolderBar(config.presentationsFolder);

    const decks = await window.electronAPI.getDecks();
    renderDecks(decks);
  } catch (err) {
    content.innerHTML =
      '<div class="loading error">Failed to load presentations: ' + err.message + '</div>';
  }
}

loadDecks();
