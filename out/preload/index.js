"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  getSidecarPort: () => electron.ipcRenderer.invoke("get-sidecar-port"),
  selectAudioFiles: () => electron.ipcRenderer.invoke("select-audio-files"),
  selectModelFile: () => electron.ipcRenderer.invoke("select-model-file"),
  windowMinimize: () => electron.ipcRenderer.send("window-minimize"),
  windowMaximize: () => electron.ipcRenderer.send("window-maximize"),
  windowClose: () => electron.ipcRenderer.send("window-close")
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (e) {
    console.error(e);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
