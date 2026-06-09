import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getSidecarPort: (): Promise<number> => ipcRenderer.invoke('get-sidecar-port'),
  selectAudioFiles: (): Promise<string[]> => ipcRenderer.invoke('select-audio-files'),
  selectModelFile: (): Promise<string | null> => ipcRenderer.invoke('select-model-file'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
