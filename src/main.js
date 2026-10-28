'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, screen, nativeImage, powerMonitor, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { extractCode, MessageGate } = require('./codes');
const { ChromeHost } = require('./chrome-host');
const { addUnreadBadge } = require('./tray-badge');
const { choosePopupSlot, detachPopup, stackPopupBounds } = require('./popup-policy');

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
let unreadCount = null;
const trayImages = new Map();
const smokeExternalLinks = [];
let smokeFinished = false;
let smokeStarted = false;
let popupRevision = 0;
const gate = new MessageGate();
const popups = new Map();
async function showMessages() {
  try {
    // An explicit open dismisses previews, not messages. This also prevents an
    // always-on-top popup from competing with the Chrome restore/focus action.
    closePopups();
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
  if (code) {
    const shortcutWasAvailable = Boolean(lastCode && Date.now() - lastCode.time < 300000);
    lastCode = { code, time: Date.now() };
    if (!shortcutWasAvailable) updateMenu();
  }
  showPopup({ title, body, code });
}
async function startChrome() {
  if (starting) return starting;
  host = new ChromeHost({ profile: path.join(app.getPath('userData'), 'chrome-profile'), url: HOME, offline: smokeTest,
    onMessage: receiveMessage, onUnread: setUnreadCount,
    onExternalLink: url => smokeTest ? smokeExternalLinks.push(url) : shell.openExternal(url),
    onDisconnect: () => { setUnreadCount(null); if (tray) tray.setToolTip('Messages Tray — Chrome closed; double-click to reopen'); },
    onError: () => { setUnreadCount(null); if (tray) tray.setToolTip('Messages Tray — page failed to load; open Messages to retry'); } });
  starting = host.start();
  try { await starting; } finally { starting = null; }
}
async function finishSmoke(code, message) {
  if (smokeFinished) return;
  smokeFinished = true;
  console.log(message);
  const reportDirectory = path.join(app.getPath('temp'), 'messages-tray-tests');
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(path.join(reportDirectory, 'smoke-report.json'), JSON.stringify({ passed: code === 0, message }));
  quitting = true; await host?.stop(); app.exit(code);
}
function makeTrayIcon(unread = false) {
  if (trayImages.has(unread)) return trayImages.get(unread);
  const base = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 32, height: 32 });
  const image = unread ? nativeImage.createFromBitmap(addUnreadBadge(base.toBitmap(), 32, 32), { width: 32, height: 32 }) : base;
  trayImages.set(unread, image);
  return image;
}
function setUnreadCount(count) {
  if (count === unreadCount) return;
  const wasUnread = unreadCount > 0;
  unreadCount = count;
  if (tray && wasUnread !== (count > 0)) { tray.setImage(makeTrayIcon(count > 0)); updateMenu(); }
}
function updateMenu() {
  if (!tray) return;
  const status = [unreadCount > 0 ? 'unread messages' : 'running', ...(paused ? ['notifications paused'] : [])];
  tray.setToolTip(`Messages Tray — ${status.join(' · ')}`);
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
function removePopup(id) {
  detachPopup(popups, id, popup => {
    clearTimeout(popup.timer); clearTimeout(popup.deliveryTimer);
    popup.pending = null;
    if (!popup.window.isDestroyed()) popup.window.close();
  });
  layoutPopups();
}
function closePopups() { for (const id of [...popups.keys()]) removePopup(id); }
function layoutPopups() {
  const area = screen.getPrimaryDisplay().workArea;
  const visible = [...popups.values()].reverse().filter(popup => popup.shown && !popup.window.isDestroyed());
  const bounds = stackPopupBounds(visible.map(popup => ({ width: 380, height: popup.requestedHeight || 170 })), area);
  visible.forEach((popup, index) => {
    const current = popup.window.getBounds(), target = bounds[index];
    if (['x', 'y', 'width', 'height'].some(key => Math.abs(current[key] - target[key]) > 1)) popup.window.setBounds(target);
  });
}
function scheduleClose(popup, delay = 18000) {
  clearTimeout(popup.timer);
  if (!popup.hovered) popup.timer = setTimeout(() => removePopup(popup.id), delay);
}
function sendPopupData(popup) {
  if (!popup.ready || popup.closing || popup.window.isDestroyed()) return;
  popup.window.webContents.send('popup-data', popup.data);
}
function updatePopup(popup, data) {
  popup.data = { ...data, revision: ++popupRevision };
  popup.pending = null;
  popups.delete(popup.id); popups.set(popup.id, popup);
  scheduleClose(popup);
  // Bound renderer traffic: one delivery per 50 ms, always with the newest text.
  if (popup.ready && !popup.deliveryTimer) popup.deliveryTimer = setTimeout(() => {
    popup.deliveryTimer = null; sendPopupData(popup);
  }, 50);
}
function showPopup(data) {
  if (locked) return;
  const slot = choosePopupSlot(popups, data.title);
  if (slot.action === 'defer') { slot.popup.pending = data; return; }
  if (slot.action === 'reuse') { updatePopup(slot.popup, data); return; }
  if (slot.action === 'skip') return;
  const window = new BrowserWindow({ width: 380, height: 170, show: false, frame: false, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, autoHideMenuBar: true, backgroundColor: '#151b28',
    webPreferences: { preload: path.join(__dirname, 'popup-preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  const popupId = window.webContents.id;
  const popup = { id: popupId, window, data: { ...data, revision: ++popupRevision }, timer: null, deliveryTimer: null,
    ready: false, shown: false, hovered: false, closing: false, pending: null };
  popups.set(popupId, popup);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.once('ready-to-show', () => {
    if (locked || popup.closing) { removePopup(popupId); return; }
    popup.ready = true;
    sendPopupData(popup);
    scheduleClose(popup);
    if (smokeTest && !smokeStarted) {
      smokeStarted = true;
      setTimeout(async () => {
        try {
          const result = await window.webContents.executeJavaScript('({title: document.getElementById("sender").textContent, button: document.getElementById("copy").textContent, hidden: document.getElementById("copy").hidden})');
          if (result.title !== 'Smoke test sender' || result.button !== 'Copy 123456' || result.hidden) throw new Error('Popup payload or Copy button mismatch');
          const contentHeight = await window.webContents.executeJavaScript('Math.ceil(document.body.getBoundingClientRect().height)');
          // Windows can add a 1–2 DIP non-client edge on a frameless window.
          if (!popup.shown || Math.abs(window.getContentBounds().height - contentHeight) > 3) throw new Error('Popup window does not fit its content: ' + JSON.stringify({ shown: popup.shown, bounds: window.getBounds(), native: window.getContentBounds(), content: contentHeight, requested: popup.requestedHeight, screen: screen.getPrimaryDisplay().scaleFactor }));
          await starting;
          const realChrome = await host.page.evaluate('({webdriver: navigator.webdriver, ua: navigator.userAgent})');
          if (realChrome.webdriver || /Electron/.test(realChrome.ua)) throw new Error('Expected regular Chrome without WebDriver mode');
          if (unreadCount !== 1) throw new Error('Initial unread conversation did not enable the tray badge');
          await host.page.evaluate(() => document.querySelector('[data-e2e-is-unread]').setAttribute('data-e2e-is-unread', 'false'));
          await new Promise(resolve => setTimeout(resolve, 750));
          if (unreadCount !== 0) throw new Error('Marking the conversation read did not clear the tray badge');
          await host.page.evaluate(() => document.querySelector('[data-e2e-is-unread]').setAttribute('data-e2e-is-unread', 'true'));
          await new Promise(resolve => setTimeout(resolve, 450));
          if (unreadCount !== 1) throw new Error('Restored unread flag did not enable the tray badge');
          await host.page.evaluate(() => {
            const list = document.querySelector('mws-conversations-list');
            list.innerHTML = '<mws-conversation-list-item><a href="/web/conversations/read-test" data-e2e-is-unread="false"><span class="name">Example</span><span class="snippet-text">Fictional read text</span></a></mws-conversation-list-item>';
          });
          await new Promise(resolve => setTimeout(resolve, 450));
          if (unreadCount !== 0) throw new Error('Removed conversation left a phantom unread badge');
          await host.hide();
          const hidden = await host.status();
          if (!hidden.count || hidden.visible !== 0) throw new Error('Chrome window failed to hide');
          const competitor = new BrowserWindow({ width: 420, height: 160, show: false, title: 'Messages Tray focus test',
            webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
          try {
            await competitor.loadURL('data:text/html,<title>Focus test</title><p>Fictional window for foreground restore testing.</p>');
            competitor.show(); competitor.focus();
            await host.show();
            const focused = await host.status();
            if (!focused.foreground || focused.topmost) throw new Error('Messages was not restored above another window without permanent topmost');
          } finally { competitor.destroy(); }
          const close = await host.testClose();
          if (!close.hookActive || !close.closeHandled || close.visible !== 0) throw new Error('Native X click handler failed to hide Chrome: ' + JSON.stringify(close));
          if (!host.browser.connected || host.page.isClosed()) throw new Error('X closed Chrome instead of hiding it');
          await host.show();
          if (!(await host.status()).visible) throw new Error('Could not restore Chrome after X-to-tray');
          await host.hide();
          const hideButton = await host.page.$('#__messagesTrayHide');
          if (!hideButton) throw new Error('Hide to tray button missing');
          await host.show();
          await host.page.bringToFront();
          await host.page.click('#external-link');
          await host.page.evaluate(() => window.open('https://example.org/messages-tray-window-test'));
          await host.page.evaluate(() => { location.href = 'https://example.org/messages-tray-navigation-test'; }).catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 500));
          if (smokeExternalLinks.length !== 3 || !smokeExternalLinks.includes('https://example.org/messages-tray-click-test') ||
              !smokeExternalLinks.includes('https://example.org/messages-tray-window-test') || !smokeExternalLinks.includes('https://example.org/messages-tray-navigation-test')) throw new Error('External link routes did not reach the default-browser handler');
          if (!host.page.url().startsWith(HOME) || (await host.browser.pages()).length !== 1) throw new Error('External link escaped into the dedicated Chrome profile');
          await host.hide();
          for (let i = 0; i < 300; i++) showPopup({ title: `Fictional chat ${i % 7}`, body: `Fictional burst message ${i}`, code: null });
          if (popups.size !== 3) throw new Error('Burst exceeded the three-window limit');
          await new Promise(resolve => setTimeout(resolve, 600));
          if (popups.size !== 3 || [...popups.values()].some(item => !item.ready || !item.shown)) throw new Error('Burst popup windows did not stay responsive');
          for (const item of popups.values()) {
            const height = await item.window.webContents.executeJavaScript('Math.ceil(document.body.getBoundingClientRect().height)');
            if (Math.abs(item.window.getContentBounds().height - height) > 3) throw new Error('Burst popup has unused space: ' + JSON.stringify({ native: item.window.getContentBounds().height, content: height, revision: item.data.revision }));
          }
          await showMessages();
          if (popups.size !== 0) throw new Error('Explicit open did not dismiss popup previews');
          const finalFocus = await host.status();
          if (!finalFocus.foreground || finalFocus.topmost) throw new Error('Opening Messages with a notification burst did not foreground the app');
          await finishSmoke(0, 'SMOKE PASS: removed unread rows clear the badge; foreground restore with pending popups; compact 300-message burst, links, and X-to-tray.');
        } catch (error) { await finishSmoke(1, 'SMOKE FAIL: ' + error.message); }
      }, 800);
    }
  });
  window.on('closed', () => { clearTimeout(popup.timer); clearTimeout(popup.deliveryTimer); detachPopup(popups, popupId); layoutPopups(); });
  window.webContents.on('render-process-gone', () => removePopup(popupId));
  window.loadFile(path.join(__dirname, 'popup.html')).catch(() => removePopup(popupId));
  scheduleClose(popup);
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
    ipcMain.handle('popup-copy', (event, revision) => {
      const popup = popups.get(event.sender.id);
      if (!popup?.data.code || popup.data.revision !== revision || locked) return false;
      clipboard.writeText(popup.data.code); scheduleClose(popup, 1600); return true;
    });
    ipcMain.on('popup-open', event => { if (popups.has(event.sender.id)) { showMessages(); removePopup(event.sender.id); } });
    ipcMain.on('popup-close', event => removePopup(event.sender.id));
    ipcMain.on('popup-hover', (event, hover) => {
      const popup = popups.get(event.sender.id); if (!popup) return;
      popup.hovered = Boolean(hover);
      if (hover) clearTimeout(popup.timer);
      else { if (popup.pending) updatePopup(popup, popup.pending); scheduleClose(popup, 10000); }
    });
    ipcMain.on('popup-size', (event, height, revision) => {
      const popup = popups.get(event.sender.id);
      if (!popup || popup.closing || popup.data.revision !== revision || !Number.isFinite(height)) return;
      height = Math.max(96, Math.min(320, Math.ceil(height)));
      // Apply size and position together from stable CSS dimensions. Reusing
      // rounded native bounds can accumulate errors at fractional Windows DPI.
      popup.requestedHeight = height;
      const firstShow = !popup.shown;
      popup.shown = true; layoutPopups();
      if (firstShow) popup.window.showInactive();
    });
    powerMonitor.on('lock-screen', () => { locked = true; closePopups(); lastCode = null; updateMenu(); });
    powerMonitor.on('unlock-screen', () => { locked = false; });
    app.on('activate', showMessages);
    // Optional, offline smoke test; does not pair a phone or read real messages.
    if (smokeTest) {
      setTimeout(() => { finishSmoke(1, 'SMOKE FAIL: notification pipeline timed out'); }, 35000);
    }
  });
}
