const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    generatePdf: (html, filename) => ipcRenderer.invoke('generate-pdf', html, filename)
});