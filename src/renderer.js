import './index.css';

function formatName(name) {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scaleIframes() {
  document.querySelectorAll('.thumbnail').forEach((el) => {
    const iframe = el.querySelector('iframe');
    if (iframe) {
      const scale = el.offsetWidth / 1920;
      iframe.style.transform = 'scale(' + scale + ')';
      el.style.paddingTop = (1080 * scale / el.offsetWidth * 100) + '%';
    }
  });
}

function showWelcome() {
  const content = document.getElementById('content');
  content.innerHTML =
    '<div class="welcome">' +
    '<p>Open a folder containing your presentations to get started.</p>' +
    '<p style="color:#666;font-size:0.85em;">Each presentation should be in its own subfolder with an index.html file.</p>' +
    '<button id="open-btn">Open Presentations Folder</button>' +
    '</div>';
  document.getElementById('open-btn').addEventListener('click', () => {
    window.electronAPI.openFolder().then((folder) => {
      if (folder) loadDecks();
    });
  });
}

function showFolderBar(folderPath) {
  // Remove existing bar if any
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

function renderDecks(decks) {
  const content = document.getElementById('content');
  if (decks.length === 0) {
    content.innerHTML =
      '<div class="loading">No presentations found in this folder.<br>' +
      'Each presentation needs its own subfolder with an index.html file.</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  decks.forEach((deck) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', () => {
      window.electronAPI.openDeck(deck.path);
    });

    const thumb = document.createElement('div');
    thumb.className = 'thumbnail';

    const iframe = document.createElement('iframe');
    iframe.src = deck.path;
    iframe.loading = 'lazy';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    thumb.appendChild(iframe);

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = formatName(deck.name);

    card.appendChild(thumb);
    card.appendChild(title);
    grid.appendChild(card);
  });

  content.innerHTML = '';
  content.appendChild(grid);

  scaleIframes();
  window.addEventListener('resize', scaleIframes);
}

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
