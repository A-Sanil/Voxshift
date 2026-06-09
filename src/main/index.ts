import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
let sidecarProcess: ChildProcess | null = null

const SIDECAR_PORT = 8765

function getSidecarPath(): string {
  if (is.dev) {
    return join(__dirname, '../../python/main.py')
  }
  const bundledPath = join(process.resourcesPath, 'python', 'main.py')
  return bundledPath
}

function spawnSidecar(): void {
  const sidecarPath = getSidecarPath()

  if (!existsSync(sidecarPath)) {
    console.warn('Python sidecar not found at', sidecarPath)
    return
  }

  const pythonExe = process.platform === 'win32' ? 'python' : 'python3'

  sidecarProcess = spawn(pythonExe, [sidecarPath, '--port', String(SIDECAR_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  })

  sidecarProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[sidecar]', data.toString().trim())
  })

  sidecarProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[sidecar:err]', data.toString().trim())
  })

  sidecarProcess.on('exit', (code) => {
    console.log('[sidecar] exited with code', code)
    sidecarProcess = null
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0F0F12',
      symbolColor: '#9A988F',
      height: 38
    },
    backgroundColor: '#0F0F12',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  spawnSidecar()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (sidecarProcess) {
    sidecarProcess.kill()
    sidecarProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (sidecarProcess) {
    sidecarProcess.kill()
  }
})

// IPC: sidecar port
ipcMain.handle('get-sidecar-port', () => SIDECAR_PORT)

// IPC: select audio file for training
ipcMain.handle('select-audio-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select training audio',
    filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'ogg', 'm4a'] }],
    properties: ['openFile', 'multiSelections']
  })
  return result.canceled ? [] : result.filePaths
})

// IPC: select model file
ipcMain.handle('select-model-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import voice model',
    filters: [
      { name: 'RVC Model', extensions: ['pth'] },
      { name: 'Index File', extensions: ['index'] }
    ],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

// IPC: window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())
