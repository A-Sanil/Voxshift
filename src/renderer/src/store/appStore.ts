import { create } from 'zustand'
import type {
  NavTab,
  VoiceModel,
  AudioDevice,
  AppSettings,
  AudioStatus,
  TrainingJob,
  Toast,
  WaveformFrame
} from '../types'

interface AppState {
  // navigation
  activeTab: NavTab
  setActiveTab: (tab: NavTab) => void

  // sidecar
  sidecarReady: boolean
  sidecarPort: number
  setSidecarReady: (ready: boolean) => void
  setSidecarPort: (port: number) => void

  // models
  models: VoiceModel[]
  setModels: (models: VoiceModel[]) => void
  addModel: (model: VoiceModel) => void
  removeModel: (id: string) => void

  // active model
  activeModelId: string | null
  setActiveModelId: (id: string | null) => void

  // audio devices
  inputDevices: AudioDevice[]
  outputDevices: AudioDevice[]
  setDevices: (input: AudioDevice[], output: AudioDevice[]) => void

  // settings
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void

  // audio state
  audioStatus: AudioStatus
  setAudioStatus: (status: AudioStatus) => void

  // waveform
  waveformAmplitudes: number[]
  setWaveformAmplitudes: (amplitudes: number[]) => void

  // training
  trainingJob: TrainingJob | null
  setTrainingJob: (job: TrainingJob | null) => void
  updateTrainingJob: (patch: Partial<TrainingJob>) => void

  // toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'voice-changer',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sidecarReady: false,
  sidecarPort: 8765,
  setSidecarReady: (ready) => set({ sidecarReady: ready }),
  setSidecarPort: (port) => set({ sidecarPort: port }),

  models: [],
  setModels: (models) => set({ models }),
  addModel: (model) => set((s) => ({ models: [...s.models, model] })),
  removeModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),

  activeModelId: null,
  setActiveModelId: (id) => set({ activeModelId: id }),

  inputDevices: [],
  outputDevices: [],
  setDevices: (input, output) => set({ inputDevices: input, outputDevices: output }),

  settings: {
    active_model_id: null,
    input_device: null,
    output_device: null,
    monitor_device: null,
    noise_suppression: true,
    monitor_enabled: false,
    pitch_shift: 0,
    formant_shift: 0,
    index_ratio: 0.75,
    buffer_size: 512,
    input_gain: 100,
    output_gain: 0,
    pitch_algo: 'rmvpe',
    gpu_acceleration: true,
    launch_at_startup: false,
    start_minimized: false,
    auto_update: true
  },
  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  audioStatus: 'idle',
  setAudioStatus: (status) => set({ audioStatus: status }),

  waveformAmplitudes: Array(32).fill(0),
  setWaveformAmplitudes: (amplitudes) => set({ waveformAmplitudes: amplitudes }),

  trainingJob: null,
  setTrainingJob: (job) => set({ trainingJob: job }),
  updateTrainingJob: (patch) =>
    set((s) => ({
      trainingJob: s.trainingJob ? { ...s.trainingJob, ...patch } : null
    })),

  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const full = { ...toast, id }
    set((s) => ({ toasts: [...s.toasts, full] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
