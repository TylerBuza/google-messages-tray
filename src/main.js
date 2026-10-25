'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, screen, nativeImage, powerMonitor, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { extractCode, MessageGate } = require('./codes');
const { ChromeHost } = require('./chrome-host');

const HOME = 'https://messages.google.com/web/conversations';
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) app.setPath('userData', path.join(app.getPath('temp'), 'messages-tray-tests', `profile-${process.pid}`));
app.setAppUserModelId('local.messages.tray');
// Explicitly keep the hidden renderer active, including when Windows occludes it.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const ownLock = app.requestSingleInstanceLock();
if (!ownLock) app.quit();

let host, starting, tray, quitting = false, paused = false, locked = false;
let lastCode = null;
const gate = new MessageGate();
const popups = new Map();
async function showMessages() {
  try {
    if (starting) await starting;
    else if (!host?.browser?.connected) await startChrome();
    await host.show();
  } catch (error) { dialog.showErrorBox('Messages Tray', error.message); }
}
async function hideMessages() {
  try { await host?.hide(); } catch (error) { dialog.showErrorBox('Could not hide Chrome', error.message); }
}
function receiveMessage(payload) {
  if (paused || locked || !payload || typeof payload.title !== 'string' || typeof payload.body !== 'string') return;
  const title = payload.title.slice(0, 200), body = payload.body.slice(0, 4000);
  if (!body || !gate.accept(title, body)) return;
  const code = extractCode(body);
  if (code) { lastCode = { code, time: Date.now() }; updateMenu(); }
  showPopup({ title, body, code });
}
async function startChrome() {
  if (starting) return starting;
  host = new ChromeHost({ profile: path.join(app.getPath('userData'), 'chrome-profile'), url: HOME, offline: smokeTest,
    onMessage: receiveMessage,
    onDisconnect: () => { if (tray) tray.setToolTip('Messages Tray — Chrome closed; double-click to reopen'); },
    onError: () => { if (tray) tray.setToolTip('Messages Tray — page failed to load; open Messages to retry'); } });
  starting = host.start();
  try { await starting; } finally { starting = null; }
}
async function finishSmoke(code, message) {
  console.log(message);
  const reportDirectory = path.join(app.getPath('temp'), 'messages-tray-tests');
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(path.join(reportDirectory, 'smoke-report.json'), JSON.stringify({ passed: code === 0, message }));
  quitting = true; await host?.stop(); app.exit(code);
}
function makeTrayIcon() {
  return nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 32, height: 32 });
}
function updateMenu() {
  if (!tray) return;
  tray.setToolTip(paused ? 'Messages Tray — notifications paused' : 'Messages Tray — running');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Google Messages / pair phone', click: showMessages },
    { label: 'Hide Messages window', click: hideMessages },
    { type: 'separator' },
    { label: 'Copy last verification code (5 min)', enabled: Boolean(lastCode && Date.now() - lastCode.time < 300000), click: () => {
      if (lastCode && Date.now() - lastCode.time < 300000) clipboard.writeText(lastCode.code);
    } },
    { label: 'Test Copy code popup', click: () => showPopup({ title: 'Messages Tray test', body: 'Your test verification code is 123456.', code: '123456' }) },
    { label: 'Pause notifications', type: 'checkbox', checked: paused, click: item => { paused = item.checked; if (paused) closePopups(); updateMenu(); } },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged, click: item => app.setLoginItemSettings({ openAtLogin: item.checked, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }) },
    { label: 'Reload Messages', click: () => { gate.seen.clear(); host?.reload().catch(error => dialog.showErrorBox('Reload failed', error.message)); } },
    { type: 'separator' },
    { label: 'Quit Messages Tray', click: () => app.quit() }
  ]));
}
function closePopups() { for (const popup of [...popups.values()]) popup.window.close(); }
function layoutPopups() {
  const area = screen.getPrimaryDisplay().workArea;
  [...popups.values()].reverse().forEach((popup, index) => {
    if (!popup.window.isDestroyed()) popup.window.setPosition(area.x + area.width - 396, area.y + area.height - 226 - index * 222);
  });
}
function scheduleClose(popup, delay = 18000) {
  clearTimeout(popup.timer);
  popup.timer = setTimeout(() => { if (!popup.window.isDestroyed()) popup.window.close(); }, delay);
}
function showPopup(data) {
  if (locked) return;
  while (popups.size >= 3) popups.values().next().value.window.close();
  const window = new BrowserWindow({ width: 380, height: 210, show: false, frame: false, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, autoHideMenuBar: true, backgroundColor: '#151b28',
    webPreferences: { preload: path.join(__dirname, 'popup-preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  const popup = { window, data, timer: null };
  const popupId = window.webContents.id;
  popups.set(popupId, popup);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.once('ready-to-show', () => {
    if (locked) { window.close(); return; }
    window.webContents.send('popup-data', data);
    layoutPopups(); window.showInactive(); scheduleClose(popup);
    if (smokeTest) {
      setTimeout(async () => {
        try {
          const result = await window.webContents.executeJavaScript('({title: document.getElementById("sender").textContent, button: document.getElementById("copy").textContent, hidden: document.getElementById("copy").hidden})');
          if (result.title !== 'Smoke test sender' || result.button !== 'Copy 123456' || result.hidden) throw new Error('Popup payload or Copy button mismatch');
          await starting;
          const realChrome = await host.page.evaluate('({webdriver: navigator.webdriver, ua: navigator.userAgent})');
          if (realChrome.webdriver || /Electron/.test(realChrome.ua)) throw new Error('Expected regular Chrome without WebDriver mode');
          await host.hide();
          const hidden = await host.status();
          if (!hidden.count || hidden.visible !== 0) throw new Error('Chrome window failed to hide');
          await host.show();
          const close = await host.testClose();
          if (!close.hookActive || !close.closeHandled || close.visible !== 0) throw new Error('Native X click handler failed to hide Chrome: ' + JSON.stringify(close));
          if (!host.browser.connected || host.page.isClosed()) throw new Error('X closed Chrome instead of hiding it');
          await host.show();
          if (!(await host.status()).visible) throw new Error('Could not restore Chrome after X-to-tray');
          await host.hide();
          const hideButton = await host.page.$('#__messagesTrayHide');
          if (!hideButton) throw new Error('Hide to tray button missing');
          await finishSmoke(0, 'SMOKE PASS: Chrome notification → Copy 123456 popup; native X hit-test and mouse callback hide Chrome without closing it; show-from-tray restores it.');
        } catch (error) { await finishSmoke(1, 'SMOKE FAIL: ' + error.message); }
      }, 800);
    }
  });
  window.on('closed', () => { clearTimeout(popup.timer); popups.delete(popupId); layoutPopups(); });
  window.loadFile(path.join(__dirname, 'popup.html'));
}

if (ownLock) {
  app.on('second-instance', showMessages);
  app.on('before-quit', event => {
    if (!quitting) {
      event.preventDefault(); quitting = true;
      Promise.resolve(host?.stop()).finally(() => app.exit(0));
    }
  });
  app.on('window-all-closed', () => {});
  app.whenReady().then(() => {
    tray = new Tray(makeTrayIcon());
    tray.on('double-click', showMessages);
    tray.on('right-click', updateMenu);
    updateMenu();
    startChrome().catch(error => {
      if (smokeTest) finishSmoke(1, 'SMOKE FAIL: ' + error.message);
      else dialog.showErrorBox('Could not open Google Chrome', error.message);
    });
    ipcMain.handle('popup-copy', event => {
      const popup = popups.get(event.sender.id);
      if (!popup?.data.code || locked) return false;
      clipboard.writeText(popup.data.code); scheduleClose(popup, 1600); return true;
    });
    ipcMain.on('popup-open', event => { const popup = popups.get(event.sender.id); if (popup) { showMessages(); popup.window.close(); } });
    ipcMain.on('popup-close', event => popups.get(event.sender.id)?.window.close());
    ipcMain.on('popup-hover', (event, hover) => { const popup = popups.get(event.sender.id); if (popup) { if (hover) clearTimeout(popup.timer); else scheduleClose(popup, 10000); } });
    powerMonitor.on('lock-screen', () => { locked = true; closePopups(); lastCode = null; updateMenu(); });
    powerMonitor.on('unlock-screen', () => { locked = false; });
    app.on('activate', showMessages);
    // Optional, offline smoke test; does not pair a phone or read real messages.
    if (smokeTest) {
      setTimeout(() => { finishSmoke(1, 'SMOKE FAIL: notification pipeline timed out'); }, 35000);
    }
  });
}
