/// <reference types="vite/client" />

interface Window {
  api: {
    getSidecarPort: () => Promise<number>
    selectAudioFiles: () => Promise<string[]>
    selectModelFile: () => Promise<string | null>
    windowMinimize: () => void
    windowMaximize: () => void
    windowClose: () => void
  }
  electron: unknown
}
