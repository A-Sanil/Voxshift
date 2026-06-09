import React, { useState } from 'react'
import type { MarketplaceVoice } from '../types'
import { useAppStore } from '../store/appStore'

interface Props {
  voice: MarketplaceVoice
  onDownloaded: (voice: MarketplaceVoice) => void
}

type DownloadState = 'idle' | 'downloading' | 'done'

export function MarketplaceCard({ voice, onDownloaded }: Props): React.ReactElement {
  const [dlState, setDlState] = useState<DownloadState>('idle')
  const [progress, setProgress] = useState(0)
  const addToast = useAppStore((s) => s.addToast)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  async function handleGet(): Promise<void> {
    if (dlState !== 'idle') return
    setDlState('downloading')
    setProgress(0)

    // Simulate download progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) {
          clearInterval(interval)
          return 95
        }
        return p + Math.random() * 15
      })
    }, 200)

    try {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500))
      clearInterval(interval)
      setProgress(100)
      setTimeout(() => {
        setDlState('done')
        onDownloaded(voice)
        addToast({
          type: 'success',
          message: `${voice.name} added to My models`,
          action: {
            label: 'View',
            onClick: () => setActiveTab('voice-changer')
          }
        })
      }, 300)
    } catch {
      clearInterval(interval)
      setDlState('idle')
      setProgress(0)
    }
  }

  return (
    <div className="group flex flex-col bg-surface rounded-lg border border-border hover:border-border-strong hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-150 overflow-hidden">
      {/* Cover art */}
      <div className="aspect-square bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-5xl border-b border-border">
        {voice.avatar}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3">
        <div>
          <div className="font-medium text-sm text-text-primary leading-tight">{voice.name}</div>
          <div className="text-xs text-text-secondary mt-0.5">by {voice.creator}</div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <DownloadIcon />
            {formatCount(voice.downloads)}
          </span>
          <span className="flex items-center gap-1">
            <StarIcon />
            {voice.rating.toFixed(1)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          {voice.preview_url && (
            <button className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary border border-border hover:border-border-strong transition-all duration-150">
              <PlayIcon />
              Preview
            </button>
          )}

          {dlState === 'idle' && (
            <button
              onClick={handleGet}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-accent text-white hover:bg-accent/85 transition-all duration-150"
            >
              Get
            </button>
          )}

          {dlState === 'downloading' && (
            <div className="flex-1 relative h-7 rounded overflow-hidden bg-accent/20">
              <div
                className="absolute inset-y-0 left-0 bg-accent transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white z-10">
                {Math.round(progress)}%
              </span>
            </div>
          )}

          {dlState === 'done' && (
            <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-live border border-live/20 bg-live-dim">
              <CheckIcon />
              Downloaded
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const DownloadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
)

const StarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
