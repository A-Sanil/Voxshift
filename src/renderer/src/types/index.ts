export type NavTab = 'voice-changer' | 'training' | 'marketplace' | 'settings'

export type ModelSource = 'marketplace' | 'local_import' | 'trained'

export interface VoiceModel {
  id: string
  name: string
  source_type: ModelSource
  file_path: string
  index_path: string | null
  avatar: string
  category: string
  added_at: string
}

export interface AudioDevice {
  index: number
  name: string
  channels: number
  default_sr: number
}

export interface AppSettings {
  active_model_id: string | null
  input_device: number | null
  output_device: number | null
  monitor_device: number | null
  noise_suppression: boolean
  monitor_enabled: boolean
  pitch_shift: number
  formant_shift: number
  index_ratio: number
  buffer_size: number
  input_gain: number
  output_gain: number
  pitch_algo: 'rmvpe' | 'harvest' | 'dio'
  gpu_acceleration: boolean
  launch_at_startup: boolean
  start_minimized: boolean
  auto_update: boolean
}

export type AudioStatus = 'idle' | 'starting' | 'live' | 'stopping' | 'error'

export type TrainingStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TrainingJob {
  id: string
  model_name: string
  total_epochs: number
  current_epoch: number
  status: TrainingStatus
  started_at: string
}

export interface WaveformFrame {
  amplitudes: number[]
  timestamp: number
}

export interface TrainingProgressEvent {
  type: 'training_progress'
  job_id: string
  epoch: number
  total: number
  loss: number
  status: TrainingStatus
}

export interface WaveformEvent {
  type: 'waveform'
  amplitudes: number[]
}

export interface AudioStatusEvent {
  type: 'audio_status'
  status: AudioStatus
  message?: string
}

export type WsEvent = TrainingProgressEvent | WaveformEvent | AudioStatusEvent

export interface MarketplaceVoice {
  id: string
  name: string
  creator: string
  category: string
  avatar: string
  downloads: number
  rating: number
  preview_url: string | null
  download_url: string
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
}
