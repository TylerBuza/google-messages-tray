'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('popup', {
  onMessage: callback => ipcRenderer.on('popup-data', (_event, data) => callback(data)),
  copy: () => ipcRenderer.invoke('popup-copy'),
  open: () => ipcRenderer.send('popup-open'),
  close: () => ipcRenderer.send('popup-close'),
  hover: value => ipcRenderer.send('popup-hover', Boolean(value))
});
