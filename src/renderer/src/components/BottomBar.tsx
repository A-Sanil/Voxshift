import React from 'react'
import { useAppStore } from '../store/appStore'
import { useSidecar } from '../hooks/useSidecar'

export function BottomBar(): React.ReactElement {
  const audioStatus = useAppStore((s) => s.audioStatus)
  const inputDevices = useAppStore((s) => s.inputDevices)
  const outputDevices = useAppStore((s) => s.outputDevices)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { apiFetch } = useSidecar()

  const isLive = audioStatus === 'live'

  async function patchSetting(patch: Record<string, unknown>): Promise<void> {
    updateSettings(patch as Parameters<typeof updateSettings>[0])
    await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(patch) })
  }

  return (
    <footer
      className={[
        'shrink-0 flex items-center gap-3 h-[56px] px-4 border-t transition-colors duration-300',
        isLive
          ? 'border-live/30 bg-[rgba(93,202,165,0.04)]'
          : 'border-[rgba(255,255,255,0.05)] bg-canvas'
      ].join(' ')}
    >
      {/* Live indicator */}
      <div className="flex items-center gap-2 min-w-[82px]">
        <span
          className={[
            'w-2 h-2 rounded-full transition-colors duration-300',
            isLive ? 'bg-live animate-pulse-live' : 'bg-text-secondary/25'
          ].join(' ')}
        />
        <span
          className={[
            'text-xs font-medium transition-colors',
            isLive ? 'text-live' : 'text-text-secondary'
          ].join(' ')}
        >
          {isLive ? 'Live' : 'Inactive'}
        </span>
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Mic input */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <MicIcon className="text-text-secondary shrink-0" />
        <DeviceSelect
          devices={inputDevices}
          value={settings.input_device}
          onChange={(v) => patchSetting({ input_device: v })}
          placeholder="Select mic..."
        />
      </div>

      {/* Arrow */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary/50 shrink-0">
        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Virtual cable output */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <CableIcon className="text-text-secondary shrink-0" />
        <DeviceSelect
          devices={outputDevices}
          value={settings.output_device}
          onChange={(v) => patchSetting({ output_device: v })}
          placeholder="Select output..."
        />
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Monitor (hear yourself) */}
      <button
        onClick={async () => {
          const newEnabled = !settings.monitor_enabled
          // Fall back to output device if no dedicated monitor device is set
          const monDev = settings.monitor_device ?? settings.output_device
          await patchSetting({ monitor_enabled: newEnabled, monitor_device: monDev })
          // Restart engine to pick up the new monitor setting
          if (isLive) {
            await apiFetch('/api/audio/stop', { method: 'POST' })
            await new Promise((r) => setTimeout(r, 300))
            await apiFetch('/api/audio/start', { method: 'POST' })
          }
        }}
        title={settings.monitor_enabled ? 'Turn off monitor — stop hearing your processed voice' : 'Turn on monitor — hear your processed voice in headphones'}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-150 shrink-0',
          settings.monitor_enabled
            ? 'bg-accent-dim text-accent border border-accent/20'
            : 'text-text-secondary hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)]'
        ].join(' ')}
      >
        <HeadphonesIcon />
        <span className="hidden sm:inline">Hear me</span>
      </button>

      {/* Noise suppression */}
      <button
        onClick={() => patchSetting({ noise_suppression: !settings.noise_suppression })}
        title="Noise suppression"
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-150 shrink-0',
          settings.noise_suppression
            ? 'bg-accent-dim text-accent border border-accent/20'
            : 'text-text-secondary hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)]'
        ].join(' ')}
      >
        <NoiseIcon />
        <span className="hidden sm:inline">Denoise</span>
      </button>
    </footer>
  )
}

function DeviceSelect({
  devices,
  value,
  onChange,
  placeholder
}: {
  devices: { index: number; name: string }[]
  value: number | null
  onChange: (v: number) => void
  placeholder?: string
}): React.ReactElement {
  return (
    <div className="relative flex-1 min-w-0">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-surface border border-border hover:border-border-strong text-text-primary text-xs rounded px-2.5 py-1.5 pr-6 cursor-pointer focus:outline-none focus:border-accent/40 transition-colors truncate"
      >
        <option value="" disabled>
          {devices.length === 0 ? 'No devices' : (placeholder ?? 'Select...')}
        </option>
        {devices.map((d) => (
          <option key={d.index} value={d.index}>
            {d.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-secondary">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

const MicIcon = ({ className }: { className?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
)

const CableIcon = ({ className }: { className?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 9a2 2 0 0 1-2-2V5h6v2a2 2 0 0 1-2 2Z" />
    <path d="M3 5V3" />
    <path d="M7 5V3" />
    <path d="M19 15a2 2 0 0 1 2 2v2h-6v-2a2 2 0 0 1 2-2Z" />
    <path d="M18 19v2" />
    <path d="M22 19v2" />
    <path d="M4 11v4a4 4 0 0 0 4 4h1" />
    <path d="M19 13V9a4 4 0 0 0-4-4h-1" />
  </svg>
)

const HeadphonesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  </svg>
)

const NoiseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h3l3-8 4 16 3-8h3" />
    <path d="M19 12h3" />
  </svg>
)
