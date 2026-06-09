import React from 'react'
import { useAppStore } from '../store/appStore'
import { useSidecar } from '../hooks/useSidecar'
import { VoiceCard, ImportCard } from '../components/VoiceCard'
import { LiveWaveform } from '../components/LiveWaveform'
import type { VoiceModel } from '../types'

// Each default voice preset maps to specific pitch/formant settings applied on selection
interface VoicePreset extends VoiceModel {
  preset_pitch: number
  preset_formant: number
}

const DEFAULT_VOICES: VoicePreset[] = [
  { id: 'default-1', name: 'Anime Girl',    source_type: 'marketplace', file_path: '', index_path: null, avatar: '🌸', category: 'Anime',     added_at: '2024-01-01T00:00:00', preset_pitch: 12,  preset_formant: 8 },
  { id: 'default-2', name: 'Deep Narrator', source_type: 'marketplace', file_path: '', index_path: null, avatar: '🎙️', category: 'Masculine',  added_at: '2024-01-01T00:00:00', preset_pitch: -8,  preset_formant: -5 },
  { id: 'default-3', name: 'Cyborg',        source_type: 'marketplace', file_path: '', index_path: null, avatar: '🤖', category: 'Robotic',    added_at: '2024-01-01T00:00:00', preset_pitch: -3,  preset_formant: -12 },
  { id: 'default-4', name: 'Soft Sage',     source_type: 'marketplace', file_path: '', index_path: null, avatar: '🍃', category: 'Feminine',   added_at: '2024-01-01T00:00:00', preset_pitch: 6,   preset_formant: 4 },
  { id: 'default-5', name: 'Villain',       source_type: 'marketplace', file_path: '', index_path: null, avatar: '😈', category: 'Character',  added_at: '2024-01-01T00:00:00', preset_pitch: -12, preset_formant: -8 },
  { id: 'default-6', name: 'High Pitch',    source_type: 'marketplace', file_path: '', index_path: null, avatar: '🎵', category: 'Character',  added_at: '2024-01-01T00:00:00', preset_pitch: 18,  preset_formant: 6 },
]

export function VoiceChangerPage(): React.ReactElement {
  const storeModels = useAppStore((s) => s.models)
  const activeModelId = useAppStore((s) => s.activeModelId)
  const setActiveModelId = useAppStore((s) => s.setActiveModelId)
  const removeModel = useAppStore((s) => s.removeModel)
  const addModel = useAppStore((s) => s.addModel)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const audioStatus = useAppStore((s) => s.audioStatus)
  const addToast = useAppStore((s) => s.addToast)
  const { apiFetch } = useSidecar()

  // Merge default voices with user models; default voices come first and can't be deleted
  const allModels = [...DEFAULT_VOICES, ...storeModels]

  async function handleSelectModel(id: string): Promise<void> {
    setActiveModelId(id)
    // If this is a default voice preset, apply its pitch/formant settings
    const preset = DEFAULT_VOICES.find((v) => v.id === id)
    const patch: Record<string, unknown> = { active_model_id: id }
    if (preset) {
      patch.pitch_shift = preset.preset_pitch
      patch.formant_shift = preset.preset_formant
      updateSettings({ active_model_id: id, pitch_shift: preset.preset_pitch, formant_shift: preset.preset_formant })
    } else {
      updateSettings({ active_model_id: id })
    }
    await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
  }

  async function handleDeleteModel(id: string): Promise<void> {
    if (id.startsWith('default-')) return
    removeModel(id)
    if (activeModelId === id) {
      setActiveModelId(null)
      updateSettings({ active_model_id: null })
    }
    await apiFetch(`/api/models/${id}`, { method: 'DELETE' })
  }

  async function handleImport(): Promise<void> {
    const filePath = await window.api?.selectModelFile()
    if (!filePath) return
    const name = filePath.split(/[\\/]/).pop()?.replace(/\.(pth|index)$/i, '') ?? 'Imported model'
    const res = await apiFetch('/api/models', {
      method: 'POST',
      body: JSON.stringify({ name, file_path: filePath, source_type: 'local_import' })
    })
    if (res.ok) {
      const model: VoiceModel = await res.json()
      addModel(model)
      addToast({ type: 'success', message: `${model.name} imported` })
    }
  }

  async function patchSetting(key: string, value: number): Promise<void> {
    updateSettings({ [key]: value } as Parameters<typeof updateSettings>[0])
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ [key]: value }) })
  }

  const isLive = audioStatus === 'live'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Waveform strip */}
      <div
        className={[
          'shrink-0 flex items-center gap-4 px-5 h-[52px] border-b transition-colors duration-300',
          isLive ? 'border-live/20 bg-[rgba(93,202,165,0.03)]' : 'border-border bg-canvas'
        ].join(' ')}
      >
        <span className="text-xs text-text-secondary w-[72px] shrink-0">
          {isLive ? 'Voice active' : 'Inactive'}
        </span>
        <div className="flex-1 overflow-hidden">
          <LiveWaveform />
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
            <span className="text-xs font-medium text-live">Transforming</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Voice grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {allModels.map((model) => (
              <VoiceCard
                key={model.id}
                model={model}
                isSelected={activeModelId === model.id}
                isBuiltIn={model.id.startsWith('default-')}
                onSelect={() => handleSelectModel(model.id)}
                onDelete={() => handleDeleteModel(model.id)}
              />
            ))}
            <ImportCard onImport={handleImport} />
          </div>
        </div>

        {/* Parameters panel */}
        <div className="w-[224px] shrink-0 border-l border-border p-5 overflow-y-auto flex flex-col gap-5">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">Parameters</div>

          <SliderParam
            label="Pitch shift"
            value={settings.pitch_shift}
            min={-24}
            max={24}
            step={1}
            format={(v) => (v > 0 ? `+${v}` : String(v))}
            onChange={(v) => patchSetting('pitch_shift', v)}
          />

          <SliderParam
            label="Formant shift"
            value={settings.formant_shift}
            min={-24}
            max={24}
            step={1}
            format={(v) => (v > 0 ? `+${v}` : String(v))}
            onChange={(v) => patchSetting('formant_shift', v)}
          />

          <SliderParam
            label="Index ratio"
            value={settings.index_ratio}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => patchSetting('index_ratio', v)}
          />

          <SliderParam
            label="Input gain"
            value={settings.input_gain}
            min={0}
            max={200}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => patchSetting('input_gain', v)}
          />

          <SliderParam
            label="Output gain"
            value={settings.output_gain}
            min={-24}
            max={12}
            step={1}
            format={(v) => (v > 0 ? `+${v} dB` : `${v} dB`)}
            onChange={(v) => patchSetting('output_gain', v)}
          />

          <div className="pt-2 border-t border-border">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Buffer size</div>
            <div className="flex flex-wrap gap-1.5">
              {[256, 512, 1024, 2048].map((size) => (
                <button
                  key={size}
                  onClick={() => patchSetting('buffer_size', size)}
                  className={[
                    'px-2 py-1 rounded text-xs font-medium transition-all duration-150',
                    settings.buffer_size === size
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-strong'
                  ].join(' ')}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              {settings.buffer_size <= 256
                ? '~ultra low latency'
                : settings.buffer_size <= 512
                ? '~low latency'
                : settings.buffer_size <= 1024
                ? '~balanced'
                : '~max stability'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SliderParam({
  label, value, min, max, step, format, onChange
}: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}): React.ReactElement {
  const progress = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs font-medium text-text-primary tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
