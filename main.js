const { app, BrowserWindow, ipcMain, session, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');

function getHtmlPath() {
  const locations = [
    path.join(app.getPath('userData'), 'pac-tracker.html'),
    path.join(path.dirname(app.getPath('exe')), 'pac-tracker.html'),
    path.join(__dirname, 'pac-tracker.html'),
  ];
  for (const p of locations) {
    if (fs.existsSync(p)) return p;
  }
  return locations[2];
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 360,
    minHeight: 500,
    title: 'PACcamélo',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ── CORS bypass per Yahoo Finance ─────────────────────────────────────────
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    details.requestHeaders['Origin'] = 'https://finance.yahoo.com';
    details.requestHeaders['Referer'] = 'https://finance.yahoo.com/';
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers['access-control-allow-origin'] = ['*'];
    headers['access-control-allow-headers'] = ['*'];
    callback({ responseHeaders: headers });
  });

  mainWindow.loadFile(getHtmlPath());
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: fetch nativo (bypassa CORS — canale usato da preload.js) ──────────
async function doNativeFetch(url) {
  return new Promise((resolve) => {
    try {
      const request = net.request({
        url,
        method: 'GET',
        session: session.defaultSession,
      });
      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      request.setHeader('Origin', 'https://finance.yahoo.com');
      request.setHeader('Referer', 'https://finance.yahoo.com/');
      request.setHeader('Accept', 'application/json, */*');
      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { data += chunk.toString(); });
        response.on('end', () => resolve({ ok: response.statusCode < 400, status: response.statusCode, text: data }));
        response.on('error', () => resolve({ ok: false, status: 0, text: '' }));
      });
      request.on('error', () => resolve({ ok: false, status: 0, text: '' }));
      request.end();
    } catch (e) {
      resolve({ ok: false, status: 0, text: '' });
    }
  });
}

// Entrambi i nomi canale per compatibilità
ipcMain.handle('fetch-native', (event, url) => doNativeFetch(url));
ipcMain.handle('fetch-url',    (event, url) => doNativeFetch(url));

// ── IPC: backup file ──────────────────────────────────────────────────────
const backupPath = path.join(app.getPath('userData'), 'paccamelo-backup.json');

ipcMain.handle('save-backup', async (event, data) => {
  try { fs.writeFileSync(backupPath, data, 'utf8'); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('load-backup', async () => {
  try {
    if (!fs.existsSync(backupPath)) return { ok: false, error: 'File non trovato' };
    return { ok: true, data: fs.readFileSync(backupPath, 'utf8') };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('auto-save', async (event, data) => {
  try { fs.writeFileSync(backupPath, data, 'utf8'); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('auto-load', async () => {
  try {
    if (!fs.existsSync(backupPath)) return { ok: false };
    return { ok: true, data: fs.readFileSync(backupPath, 'utf8') };
  } catch (e) { return { ok: false }; }
});

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  userData: app.getPath('userData'),
}));


// DevTools con Ctrl+Shift+I
const { globalShortcut } = require('electron');
app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });
});
