'use strict';
// Capture the actual notification UI with fictional text. Never read a profile.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 380, height: 210, show: false, frame: false,
    webPreferences: { preload: path.join(__dirname, '../src/popup-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  ipcMain.handle('popup-copy', () => true);
  await window.loadFile(path.join(__dirname, '../src/popup.html'));
  window.webContents.send('popup-data', { title: 'Example Service', body: 'Your verification code is 123456. Do not share this code.', code: '123456' });
  await new Promise(resolve => setTimeout(resolve, 500));
  const height = await window.webContents.executeJavaScript('Math.ceil(document.body.getBoundingClientRect().height)');
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: 380, height });
  const output = path.join(__dirname, '../docs/images/notification-demo.png');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, image.toPNG());
  console.log('Saved synthetic notification demo: docs/images/notification-demo.png');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
