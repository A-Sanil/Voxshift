import React from 'react'
import { useAppStore } from '../store/appStore'
import { useSidecar } from '../hooks/useSidecar'

const TAB_TITLES: Record<string, string> = {
  'voice-changer': 'Voice changer',
  training: 'Training',
  marketplace: 'Marketplace',
  settings: 'Settings'
}

export function TopBar(): React.ReactElement {
  const activeTab = useAppStore((s) => s.activeTab)
  const audioStatus = useAppStore((s) => s.audioStatus)
  const sidecarReady = useAppStore((s) => s.sidecarReady)
  const setAudioStatus = useAppStore((s) => s.setAudioStatus)
  const { apiFetch } = useSidecar()

  const isLive = audioStatus === 'live'
  const isTransitioning = audioStatus === 'starting' || audioStatus === 'stopping'

  async function handleToggle(): Promise<void> {
    if (!sidecarReady || isTransitioning) return
    if (isLive) {
      setAudioStatus('stopping')
      await apiFetch('/api/audio/stop', { method: 'POST' })
    } else {
      setAudioStatus('starting')
      await apiFetch('/api/audio/start', { method: 'POST' })
    }
  }

  return (
    <header className="drag-region flex items-center h-[52px] pl-5 pr-[148px] border-b border-[rgba(255,255,255,0.05)] bg-canvas shrink-0">
      <h1 className="no-drag flex-1 text-md font-medium text-text-primary">
        {TAB_TITLES[activeTab] ?? activeTab}
      </h1>

      {/* Live badge */}
      {isLive && (
        <div className="no-drag flex items-center gap-1.5 mr-4 px-2.5 py-1 rounded-full bg-live-dim border border-live/20">
          <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
          <span className="text-xs font-medium text-live">Live</span>
        </div>
      )}

      {/* Start / Stop */}
      <button
        onClick={handleToggle}
        disabled={!sidecarReady || isTransitioning}
        className={[
          'no-drag flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all duration-200',
          isLive
            ? 'bg-live/15 text-live border border-live/25 hover:bg-live/25'
            : 'bg-accent text-white hover:bg-accent/85 shadow-accent',
          (!sidecarReady || isTransitioning) && 'opacity-40 cursor-not-allowed pointer-events-none'
        ].join(' ')}
      >
        {isTransitioning ? (
          <SpinnerIcon />
        ) : isLive ? (
          <StopIcon />
        ) : (
          <PlayIcon />
        )}
        {isTransitioning ? 'Working...' : isLive ? 'Stop' : 'Start'}
      </button>
    </header>
  )
}

const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)

const SpinnerIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    className="animate-spin"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)
