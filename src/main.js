import { app, BrowserWindow, ipcMain, dialog, Menu, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';

if (started) app.quit();

// ── Config persistence ──────────────────────────────────────

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')); }
  catch { return {}; }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getPresentationsFolder() {
  return loadConfig().presentationsFolder || null;
}

function setPresentationsFolder(folderPath) {
  const config = loadConfig();
  config.presentationsFolder = folderPath;
  saveConfig(config);
}

// ── Window ──────────────────────────────────────────────────

let mainWindow;

function goHome() {
  if (!mainWindow) return;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Presentations',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow file:// cross-origin for markdown plugin fetch
    },
  });

  goHome();

  // Inject a floating home button when viewing a presentation (file:// page)
  mainWindow.webContents.on('did-navigate', (_event, url) => {
    if (url.startsWith('file://')) {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          if (document.getElementById('__home-btn')) return;
          var btn = document.createElement('button');
          btn.id = '__home-btn';
          btn.textContent = '⬅ Home';
          btn.style.cssText = 'position:fixed;top:12px;left:12px;z-index:999999;' +
            'background:rgba(0,0,0,0.7);color:#fff;border:1px solid rgba(255,255,255,0.3);' +
            'padding:6px 16px;border-radius:6px;cursor:pointer;font-size:14px;' +
            'font-family:system-ui;backdrop-filter:blur(8px);opacity:0.5;transition:opacity 0.2s;';
          btn.onmouseenter = function() { btn.style.opacity = '1'; };
          btn.onmouseleave = function() { btn.style.opacity = '0.5'; };
          btn.onclick = function() {
            window.electronAPI.goHome();
          };
          document.body.appendChild(btn);
        })();
      `);
    }
  });
};

// ── Menu ────────────────────────────────────────────────────

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

// ── Protocol handler for dist/ paths ────────────────────────

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.md': 'text/markdown', '.map': 'application/json',
};

function registerProtocolHandler() {
  const revealDir = path.join(app.getAppPath(), 'reveal');

  session.defaultSession.protocol.handle('file', (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);

    // Intercept /dist/ and /plugin/ paths → serve from bundled reveal/
    const bundledMatch = filePath.match(/\/(dist|plugin)\/(.*)/);
    if (bundledMatch) {
      const revealPath = path.join(revealDir, bundledMatch[1], bundledMatch[2]);
      if (fs.existsSync(revealPath)) {
        const ext = path.extname(revealPath).toLowerCase();
        return new Response(fs.readFileSync(revealPath), {
          headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
        });
      }
    }

    // Default: serve file directly from disk (net.fetch would re-enter this handler)
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      return new Response(fs.readFileSync(filePath), {
        headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
      });
    }

    return new Response('Not found', { status: 404 });
  });
}

// ── IPC Handlers ────────────────────────────────────────────

function registerIPC() {
  const SKIP_DIRS = new Set(['common', 'images', 'dist', 'node_modules', '.git']);

  ipcMain.handle('get-decks', () => {
    const folder = getPresentationsFolder();
    if (!folder || !fs.existsSync(folder)) return [];

    const decks = [];
    for (const entry of fs.readdirSync(folder)) {
      if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
      const entryPath = path.join(folder, entry);
      if (
        fs.statSync(entryPath).isDirectory() &&
        fs.existsSync(path.join(entryPath, 'index.html'))
      ) {
        decks.push({
          name: entry,
          path: 'file://' + path.join(folder, entry, 'index.html'),
        });
      }
    }
    return decks;
  });

  ipcMain.handle('get-config', () => {
    return { presentationsFolder: getPresentationsFolder() };
  });

  ipcMain.handle('open-folder', () => openFolderDialog());
  ipcMain.handle('go-home', () => goHome());

  ipcMain.handle('open-deck', (_event, url) => {
    if (mainWindow && url.startsWith('file://')) {
      mainWindow.loadURL(url);
    }
  });
}

// ── App lifecycle ───────────────────────────────────────────

app.whenReady().then(() => {
  registerProtocolHandler();
  registerIPC();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
