'use strict';
// Render the real tray bitmap compositor for docs; no profile or messages used.
const { app, nativeImage, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { addTrayIndicators } = require('../src/tray-badge');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  const base = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 32, height: 32 });
  const previewBase = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 128, height: 128 });
  const output = path.join(__dirname, '../docs/images');
  fs.mkdirSync(output, { recursive: true });
  const previews = {};
  for (const [name, unread, lowBattery] of [['normal', false, false], ['unread', true, false], ['battery', false, true], ['both', true, true]]) {
    const image = nativeImage.createFromBitmap(addTrayIndicators(base.toBitmap(), 32, 32, { unread, lowBattery }), { width: 32, height: 32 });
    fs.writeFileSync(path.join(output, `tray-${name}.png`), image.toPNG());
    previews[name] = nativeImage.createFromBitmap(addTrayIndicators(previewBase.toBitmap(), 128, 128, { unread, lowBattery }), { width: 128, height: 128 }).toDataURL();
  }
  const cards = [['unread', 'Unread messages', 'Red · top-right'], ['battery', 'Low phone battery', 'Amber · bottom-left'], ['both', 'Both together', 'Independent indicators']]
    .map(([name, title, subtitle]) => `<section><img src="${previews[name]}" alt="${title}"><strong>${title}</strong><span>${subtitle}</span></section>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#0f1420;font-family:'Segoe UI',sans-serif;color:#eff4ff}main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:14px;height:208px}section{background:#151b28;border:1px solid #37445d;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center}img{width:72px;height:72px;margin-bottom:10px}strong{color:#eff4ff;font-size:19px;font-weight:650;line-height:24px}span{color:#b7c3db;font-size:14px;line-height:20px;margin-top:3px}</style></head><body><main>${cards}</main></body></html>`;
  const window = new BrowserWindow({ width: 960, height: 208, frame: false, show: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(resolve => setTimeout(resolve, 200));
  fs.writeFileSync(path.join(output, 'tray-indicators.png'), (await window.webContents.capturePage()).toPNG());
  console.log('Saved real tray icon examples and docs/images/tray-indicators.png');
  app.exit(0);
}).catch(error => { console.error(error.message); app.exit(1); });
