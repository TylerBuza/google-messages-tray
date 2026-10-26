'use strict';
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { installNotificationHook } = require('./page-hook');
const { createWatcher } = require('./watcher');
const { isCompanionUrl, getExternalUrl, installLinkRouting } = require('./links');

function findChrome(env = process.env) {
  const candidates = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]
    .filter(Boolean).map(root => path.join(root, 'Google/Chrome/Application/chrome.exe'));
  return candidates.find(file => fs.existsSync(file));
}
async function localPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
function makeWindowController(pid) {
  const source = fs.readFileSync(path.join(__dirname, 'window-helper.ps1'), 'utf8').replace('__OWNER_PID__', String(pid));
  const helper = spawn(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let pending = [];
  const rejectPending = () => { for (const item of pending.splice(0)) { clearTimeout(item.timer); item.reject(new Error('Window helper exited')); } };
  helper.on('error', rejectPending); helper.on('exit', rejectPending);
  helper.stdin.on('error', rejectPending);
  helper.stderr.on('data', () => {});
  readline.createInterface({ input: helper.stdout }).on('line', line => {
    const item = pending.shift(); if (!item) return;
    clearTimeout(item.timer);
    try { const result = JSON.parse(line); if (!result.ok) throw new Error('Window control failed'); item.resolve(result); }
    catch (error) { item.reject(error); }
  });
  return {
    command(value) {
      return new Promise((resolve, reject) => {
        const item = { resolve, reject };
        item.timer = setTimeout(() => { reject(new Error('Window helper timed out')); helper.kill(); }, 15000);
        pending.push(item); helper.stdin.write(value + '\n');
      });
    },
    stop() { helper.stdin.end(); helper.kill(); }
  };
}

// Installs only in the Messages top frame. Google sign-in runs unmodified in Chrome.
function installPageCompanion() {
  if (location.origin !== 'https://messages.google.com' || window.top !== window) return;
  const notify = payload => window.__messagesTrayNotify(JSON.stringify(payload)).catch(() => {});
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.type === 'messages-tray-notification') {
      notify({ title: String(event.data.title || ''), body: String(event.data.body || '') });
    }
  });
  installNotificationHook();
  const start = () => {
    const watcher = createWatcher(document, notify, count => window.__messagesTrayUnread(count).catch(() => {}));
    let timer;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(watcher.scan, 350); })
      .observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-is-unread', 'data-e2e-is-unread'] });
    watcher.scan(); setInterval(watcher.scan, 3000);
  };
  window.addEventListener('DOMContentLoaded', start, { once: true });
}
function installHideButton() {
  if (!['messages.google.com', 'accounts.google.com'].includes(location.hostname) || window.top !== window) return;
  if (!document.body || document.getElementById('__messagesTrayHide')) return;
  const button = document.createElement('button'); button.id = '__messagesTrayHide';
  button.textContent = 'Hide to tray';
  button.setAttribute('style', 'position:fixed;right:18px;bottom:18px;z-index:2147483647;background:#a9c8ff;color:#101c31;border:1px solid #5278b5;border-radius:24px;padding:12px 20px;font:600 14px Segoe UI,sans-serif;cursor:pointer;box-shadow:0 3px 16px #0006');
  button.onclick = () => window.__messagesTrayHide().catch(() => {});
  document.body.appendChild(button);
}

class ChromeHost {
  constructor({ profile, url, onMessage, onUnread, onExternalLink, onDisconnect, onError, offline = false }) {
    Object.assign(this, { profile, url, onMessage, onUnread, onExternalLink, onDisconnect, onError, offline });
    this.browser = null; this.page = null; this.controller = null; this.stopping = false;
    this.externalRequests = new Map();
    this.routedPages = new WeakSet();
  }
  async openExternal(value) {
    if (this.stopping || !this.page || !isCompanionUrl(this.page.url())) return;
    const url = getExternalUrl(value, this.page.url());
    if (!url) return;
    const now = Date.now();
    for (const [key, time] of this.externalRequests) if (now - time > 1500) this.externalRequests.delete(key);
    if (this.externalRequests.has(url) || this.externalRequests.size >= 8) return;
    this.externalRequests.set(url, now);
    try { await this.onExternalLink?.(url); } catch { this.onError?.(new Error('Could not open the link in your default browser.')); }
  }
  async routePage(page, popup = false) {
    if (this.routedPages.has(page)) return;
    this.routedPages.add(page);
    await page.setRequestInterception(true);
    page.on('request', request => {
      const external = request.isNavigationRequest() && request.frame() === page.mainFrame() && getExternalUrl(request.url());
      if (external) {
        request.abort('aborted').catch(() => {});
        this.openExternal(external);
        if (popup) page.close().catch(() => {});
      } else if (this.offline) {
        request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Offline smoke test</title><body><a id="external-link" href="https://example.org/messages-tray-click-test" target="_blank">Fictional external link</a><mws-conversations-list><mws-conversation-list-item><a href="/web/conversations/test" data-e2e-is-unread="true"><span class="name">Example</span><span class="snippet-text">Fictional unread text</span></a></mws-conversation-list-item></mws-conversations-list><script>setTimeout(() => new Notification("Smoke test sender", {body:"Your verification code is 123456."}), 1500);</script></body>' }).catch(() => {});
      } else request.continue().catch(() => {});
    });
    if (popup) {
      const routePopup = async () => {
        const external = getExternalUrl(page.url());
        if (external) { await this.openExternal(external); await page.close().catch(() => {}); }
      };
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) routePopup().catch(() => {}); });
      await routePopup();
    }
  }
  async start() {
    const executablePath = findChrome();
    if (!executablePath) throw new Error('Google Chrome was not found. Install Chrome, then reopen Messages Tray.');
    const startHidden = !this.offline && fs.existsSync(path.join(this.profile, 'Default', 'Preferences'));
    fs.mkdirSync(this.profile, { recursive: true });
    // Real Chrome and separate profile; no headless, enable-automation, stealth
    // patches, or copying Chrome cookies. Connect on a random loopback-only port.
    const port = await localPort();
    const { default: puppeteer } = await import('puppeteer-core');
    this.browser = await puppeteer.launch({ executablePath, pipe: false, ignoreDefaultArgs: true,
      defaultViewport: null, timeout: 30000, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
      args: [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${this.profile}`, '--app=about:blank', '--no-first-run', '--no-default-browser-check',
        ...(startHidden ? ['--start-minimized'] : []),
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
    this.browser.on('disconnected', () => { this.controller?.stop(); if (!this.stopping) this.onDisconnect?.(); });
    this.controller = makeWindowController(this.browser.process().pid);
    const pages = await this.browser.pages(); this.page = pages[0] || await this.browser.newPage();
    await this.browser.defaultBrowserContext().overridePermissions('https://messages.google.com', ['notifications']);
    await this.page.exposeFunction('__messagesTrayNotify', async text => {
      if (this.stopping || typeof text !== 'string' || text.length > 16000) return;
      if (new URL(this.page.url()).origin !== 'https://messages.google.com') return;
      try { const data = JSON.parse(text); this.onMessage(data); } catch { /* Invalid page payload. */ }
    });
    await this.page.exposeFunction('__messagesTrayUnread', async count => {
      if (this.stopping || new URL(this.page.url()).origin !== 'https://messages.google.com') return;
      if (count !== null && (!Number.isSafeInteger(count) || count < 0 || count > 100000)) return;
      this.onUnread?.(count);
    });
    await this.page.exposeFunction('__messagesTrayExternal', value => this.openExternal(value));
    await this.page.exposeFunction('__messagesTrayHide', async () => {
      const origin = new URL(this.page.url()).origin;
      if (['https://messages.google.com', 'https://accounts.google.com'].includes(origin)) await this.hide();
    });
    await this.page.evaluateOnNewDocument(`(() => { const installNotificationHook = ${installNotificationHook.toString()}; const createWatcher = ${createWatcher.toString()}; (${installPageCompanion.toString()})(); })()`);
    await this.page.evaluateOnNewDocument(`(() => { const isCompanionUrl = ${isCompanionUrl.toString()}; const getExternalUrl = ${getExternalUrl.toString()}; (${installLinkRouting.toString()})(); })()`);
    this.page.on('domcontentloaded', () => this.page.evaluate(installHideButton).catch(() => {}));
    await this.routePage(this.page);
    this.browser.on('targetcreated', async target => {
      if (this.stopping || target.type() !== 'page') return;
      try { const popup = await target.page(); if (popup && popup !== this.page) await this.routePage(popup, true); } catch { /* Popup already closed. */ }
    });
    if (startHidden) await this.hide(); else await this.show();
    // Do not delay tray startup waiting for Google's network or account redirects.
    this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(error => this.onError?.(error));
  }
  async show() { if (this.controller) return this.controller.command('show'); }
  async hide() { if (this.controller) return this.controller.command('hide'); }
  async status() { if (this.controller) return this.controller.command('status'); }
  async testClose() { if (this.offline && this.controller) return this.controller.command('test-close'); }
  async reload() { if (this.page && !this.page.isClosed()) await this.page.reload({ waitUntil: 'domcontentloaded' }); }
  async stop() {
    this.stopping = true;
    try { await this.browser?.close(); } catch { /* Already closed. */ }
    this.controller?.stop(); this.browser = null;
  }
}
module.exports = { ChromeHost, findChrome };
