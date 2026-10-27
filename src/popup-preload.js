'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('popup', {
  onMessage: callback => ipcRenderer.on('popup-data', (_event, data) => callback(data)),
  copy: revision => ipcRenderer.invoke('popup-copy', revision),
  resize: (height, revision) => ipcRenderer.send('popup-size', height, revision),
  open: () => ipcRenderer.send('popup-open'),
  close: () => ipcRenderer.send('popup-close'),
  hover: value => ipcRenderer.send('popup-hover', Boolean(value))
});
