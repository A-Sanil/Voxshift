"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
const utils = require("@electron-toolkit/utils");
let mainWindow = null;
let sidecarProcess = null;
const SIDECAR_PORT = 8765;
function spawnSidecar() {
  let cmd;
  let args;
  if (utils.is.dev) {
    const scriptPath = path.join(__dirname, "../../python/main.py");
    if (!fs.existsSync(scriptPath)) {
      console.warn("[sidecar] python/main.py not found");
      return;
    }
    cmd = process.platform === "win32" ? "python" : "python3";
    args = [scriptPath, "--port", String(SIDECAR_PORT)];
  } else {
    const binaryName = process.platform === "win32" ? "voxshift_sidecar.exe" : "voxshift_sidecar";
    const binaryPath = path.join(process.resourcesPath, "sidecar", binaryName);
    const scriptPath = path.join(process.resourcesPath, "python", "main.py");
    if (fs.existsSync(binaryPath)) {
      cmd = binaryPath;
      args = ["--port", String(SIDECAR_PORT)];
    } else if (fs.existsSync(scriptPath)) {
      cmd = process.platform === "win32" ? "python" : "python3";
      args = [scriptPath, "--port", String(SIDECAR_PORT)];
    } else {
      console.warn("[sidecar] No sidecar binary or script found");
      return;
    }
  }
  sidecarProcess = child_process.spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false
  });
  sidecarProcess.stdout?.on("data", (data) => {
    console.log("[sidecar]", data.toString().trim());
  });
  sidecarProcess.stderr?.on("data", (data) => {
    console.error("[sidecar:err]", data.toString().trim());
  });
  sidecarProcess.on("exit", (code) => {
    console.log("[sidecar] exited with code", code);
    sidecarProcess = null;
  });
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0F0F12",
      symbolColor: "#9A988F",
      height: 38
    },
    backgroundColor: "#0F0F12",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  spawnSidecar();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (sidecarProcess) {
    sidecarProcess.kill();
    sidecarProcess = null;
  }
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  if (sidecarProcess) {
    sidecarProcess.kill();
  }
});
electron.ipcMain.handle("get-sidecar-port", () => SIDECAR_PORT);
electron.ipcMain.handle("select-audio-files", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Select training audio",
    filters: [{ name: "Audio", extensions: ["wav", "mp3", "flac", "ogg", "m4a"] }],
    properties: ["openFile", "multiSelections"]
  });
  return result.canceled ? [] : result.filePaths;
});
electron.ipcMain.handle("select-model-file", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Import voice model",
    filters: [
      { name: "RVC Model", extensions: ["pth"] },
      { name: "Index File", extensions: ["index"] }
    ],
    properties: ["openFile"]
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.on("window-minimize", () => mainWindow?.minimize());
electron.ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
electron.ipcMain.on("window-close", () => mainWindow?.close());
