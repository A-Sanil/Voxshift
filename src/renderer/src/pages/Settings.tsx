import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useSidecar } from '../hooks/useSidecar'

export function SettingsPage(): React.ReactElement {
  const sidecarReady = useAppStore((s) => s.sidecarReady)
  const sidecarPort = useAppStore((s) => s.sidecarPort)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const addToast = useAppStore((s) => s.addToast)
  const { apiFetch } = useSidecar()

  const [showLogs, setShowLogs] = useState(false)

  async function patchSetting(patch: Record<string, unknown>): Promise<void> {
    updateSettings(patch as Parameters<typeof updateSettings>[0])
    await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(patch) })
  }

  async function handleClearCache(): Promise<void> {
    await apiFetch('/api/cache', { method: 'DELETE' })
    addToast({ type: 'success', message: 'Cache cleared' })
  }

  async function handleResetDefaults(): Promise<void> {
    const defaults = {
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
    }
    updateSettings(defaults as Parameters<typeof updateSettings>[0])
    await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(defaults) })
    addToast({ type: 'success', message: 'Settings reset to defaults' })
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="w-full max-w-[540px] flex flex-col gap-6 animate-fade-in">

        <div>
          <h2 className="text-xl font-medium text-text-primary mb-1">Settings</h2>
          <p className="text-sm text-text-secondary">Configure audio, app behavior, and storage.</p>
        </div>

        {/* ── Audio ── */}
        <Section title="Audio">
          <ToggleRow
            label="Noise suppression"
            description="Remove background noise from your mic input"
            value={settings.noise_suppression}
            onChange={(v) => patchSetting({ noise_suppression: v })}
          />
          <ToggleRow
            label="GPU acceleration"
            description="Use CUDA / Metal for faster inference"
            value={settings.gpu_acceleration}
            onChange={(v) => patchSetting({ gpu_acceleration: v })}
          />
          <SliderRow
            label="Buffer size"
            description="Lower = less latency, higher = more stable"
            value={settings.buffer_size}
            options={[256, 512, 1024, 2048]}
            format={(v) => `${v} samples`}
            onChange={(v) => patchSetting({ buffer_size: v })}
          />
        </Section>

        {/* ── App ── */}
        <Section title="App">
          <ToggleRow
            label="Launch at startup"
            description="Start VoxShift automatically when you log in"
            value={settings.launch_at_startup}
            onChange={(v) => patchSetting({ launch_at_startup: v })}
          />
          <ToggleRow
            label="Start minimized to tray"
            description="Open in the system tray instead of a visible window"
            value={settings.start_minimized}
            onChange={(v) => patchSetting({ start_minimized: v })}
          />
          <ToggleRow
            label="Auto-update"
            description="Download and install updates automatically"
            value={settings.auto_update}
            onChange={(v) => patchSetting({ auto_update: v })}
          />
        </Section>

        {/* ── Storage ── */}
        <Section title="Storage">
          <Row label="Models folder" description="Where your .pth files are saved">
            <button
              onClick={() => addToast({ type: 'info', message: 'Folder picker coming in v0.2' })}
              className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
            >
              Browse ↗
            </button>
          </Row>
          <Row label="Cache" description="Marketplace thumbnails and preview audio">
            <button
              onClick={handleClearCache}
              className="text-xs text-text-secondary hover:text-text-primary border border-border hover:border-border-strong px-2.5 py-1 rounded transition-all duration-150"
            >
              Clear cache
            </button>
          </Row>
        </Section>

        {/* ── Advanced ── */}
        <Section title="Advanced">
          <Row label="Show debug logs" description="Open the real-time log viewer">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={[
                'text-xs px-2.5 py-1 rounded border transition-all duration-150',
                showLogs
                  ? 'text-accent border-accent/30 bg-accent-dim'
                  : 'text-text-secondary border-border hover:border-border-strong hover:text-text-primary'
              ].join(' ')}
            >
              {showLogs ? 'Close logs' : 'Open logs'}
            </button>
          </Row>
          <Row label="Reset to defaults" description="Restore all settings to their original values">
            <button
              onClick={handleResetDefaults}
              className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 rounded transition-all duration-150"
            >
              Reset
            </button>
          </Row>
        </Section>

        {showLogs && (
          <div className="bg-[#0a0a0d] border border-border rounded-lg p-4 font-mono text-xs text-green-400/80 h-[180px] overflow-y-auto">
            <div>[voxshift] sidecar port: {sidecarPort}</div>
            <div>[voxshift] backend status: {sidecarReady ? 'connected' : 'waiting...'}</div>
            <div>[audio] engine: idle</div>
            <div>[db] sqlite connected at ~/.voxshift/voxshift.db</div>
          </div>
        )}

        {/* ── Backend status ── */}
        <Section title="Backend status">
          <Row label="Python sidecar" description="Local audio processing engine">
            <div className="flex items-center gap-2">
              <span className={['w-2 h-2 rounded-full', sidecarReady ? 'bg-live animate-pulse-live' : 'bg-text-secondary/30'].join(' ')} />
              <span className={['text-xs font-medium', sidecarReady ? 'text-live' : 'text-text-secondary'].join(' ')}>
                {sidecarReady ? 'Connected' : 'Waiting...'}
              </span>
            </div>
          </Row>
          <Row label="API port" description="">
            <span className="font-mono text-xs text-text-secondary">{sidecarPort}</span>
          </Row>
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <Row label="Version" description=""><span className="text-xs text-text-secondary">0.1.0 alpha</span></Row>
          <Row label="License" description=""><span className="text-xs text-text-secondary">MIT</span></Row>
          <Row label="GitHub" description="">
            <a
              href="https://github.com/A-Sanil/Voxshift"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); window.open('https://github.com/A-Sanil/Voxshift') }}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              github.com/A-Sanil/Voxshift ↗
            </a>
          </Row>
          <Row label="Keyboard shortcuts" description="">
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {[['1', 'Voice'], ['2', 'Train'], ['3', 'Market']].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1 text-xs text-text-secondary">
                  <Kbd>{key}</Kbd>{label}
                </span>
              ))}
            </div>
          </Row>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{title}</div>
      <div className="bg-surface rounded-lg border border-border divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-text-primary">{label}</div>
        {description && <div className="text-xs text-text-secondary mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}): React.ReactElement {
  return (
    <Row label={label} description={description}>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={[
          'relative w-9 h-5 rounded-full transition-colors duration-200',
          value ? 'bg-accent' : 'bg-[rgba(255,255,255,0.1)]'
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            value ? 'translate-x-4' : 'translate-x-0.5'
          ].join(' ')}
        />
      </button>
    </Row>
  )
}

function SliderRow({ label, description, value, options, format, onChange }: {
  label: string; description: string; value: number
  options: number[]; format: (v: number) => string; onChange: (v: number) => void
}): React.ReactElement {
  return (
    <Row label={label} description={description}>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={[
              'px-2 py-0.5 rounded text-xs font-medium transition-all duration-150',
              value === o
                ? 'bg-accent text-white'
                : 'bg-[rgba(255,255,255,0.06)] text-text-secondary hover:text-text-primary'
            ].join(' ')}
          >
            {o}
          </button>
        ))}
      </div>
    </Row>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="px-1.5 py-0.5 text-xs font-medium text-text-secondary bg-[rgba(255,255,255,0.06)] border border-border rounded">
      {children}
    </kbd>
  )
}
