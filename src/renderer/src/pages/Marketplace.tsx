import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import type { DownloadPhase } from '../types'

interface MarketVoice {
  id: string
  name: string
  full_name: string
  creator: string
  avatar: string
  category: string
  file_size: string | null
  epochs: number | null
  pitch_algo: string
  rvc_version: string
  download_url: string | null
  download_type: string
  model_page_url: string
}

const CATEGORIES = ['All', 'Anime', 'Singer', 'Character', 'Game', 'Feminine', 'Masculine', 'Robotic']
const SORT_OPTIONS = [
  { value: 'new', label: 'Newest' },
  { value: 'top', label: 'Most popular' },
  { value: 'female', label: 'Female voices' },
  { value: 'male', label: 'Male voices' },
]

export function MarketplacePage(): React.ReactElement {
  const [voices, setVoices] = useState<MarketVoice[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pendingSearch, setPendingSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('new')

  const sidecarReady = useAppStore((s) => s.sidecarReady)
  const sidecarPort = useAppStore((s) => s.sidecarPort)
  const activeDownloads = useAppStore((s) => s.activeDownloads)
  const addToast = useAppStore((s) => s.addToast)

  const apiBase = `http://localhost:${sidecarPort}`
  const apiFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${apiBase}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        ...init,
      }),
    [apiBase]
  )

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch voices ──────────────────────────────────────────────────────────
  const fetchVoices = useCallback(
    async (p: number, q: string, s: string, cat: string, replace: boolean) => {
      if (!sidecarReady) return
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ page: String(p), search: q, sort: s, category: cat })
        const res = await apiFetch(`/api/marketplace?${params}`)
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const data = await res.json()
        setVoices((prev) => (replace ? data.models : [...prev, ...data.models]))
        setHasMore(data.has_more)
        if (data.error) setError(`Warning: ${data.error}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load marketplace')
      } finally {
        setLoading(false)
      }
    },
    [sidecarReady, apiFetch]
  )

  useEffect(() => {
    setPage(1)
    setVoices([])
    fetchVoices(1, search, sort, category, true)
  }, [search, sort, category, fetchVoices])

  function handleSearchChange(value: string): void {
    setPendingSearch(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setSearch(value), 400)
  }

  function loadMore(): void {
    const next = page + 1
    setPage(next)
    fetchVoices(next, search, sort, category, false)
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleGet(voice: MarketVoice): Promise<void> {
    const dl = activeDownloads[voice.id]
    if (dl && dl.phase !== 'error') return
    if (!voice.download_url) {
      window.open(voice.model_page_url, '_blank')
      return
    }
    const res = await apiFetch('/api/marketplace/download', {
      method: 'POST',
      body: JSON.stringify({
        id: voice.id,
        name: voice.name,
        download_url: voice.download_url,
        download_type: voice.download_type,
        avatar: voice.avatar,
        category: voice.category,
      }),
    })
    if (!res.ok) {
      addToast({ type: 'error', message: 'Could not start download' })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border bg-canvas flex-wrap">
        <div className="relative min-w-[200px] flex-shrink-0">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={pendingSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search 221,000+ voices..."
            className="w-full bg-surface border border-border hover:border-border-strong focus:border-accent/50 text-text-primary text-xs rounded px-3 py-1.5 pl-8 outline-none transition-colors placeholder:text-text-secondary/40"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150',
                category === c
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary bg-surface border border-border hover:border-border-strong',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="ml-auto relative shrink-0">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-surface border border-border hover:border-border-strong text-text-secondary text-xs rounded px-2.5 py-1.5 pr-6 outline-none cursor-pointer focus:border-accent/40 transition-colors"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-5 py-2 flex items-center gap-2">
        {loading && voices.length === 0 ? (
          <span className="text-xs text-text-secondary flex items-center gap-1.5">
            <SpinnerIcon />
            Loading voices from voice-models.com...
          </span>
        ) : error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : (
          <span className="text-xs text-text-secondary">
            {voices.length} voices loaded{hasMore ? ' — scroll for more' : ''}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {!sidecarReady ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <div className="text-sm font-medium text-text-primary mb-1">Connecting to backend...</div>
            <div className="text-xs text-text-secondary">Start the Python sidecar to browse voices</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {voices.map((voice) => (
                <VoiceMarketCard
                  key={voice.id}
                  voice={voice}
                  dlEntry={activeDownloads[voice.id]}
                  onGet={() => handleGet(voice)}
                />
              ))}
            </div>

            {voices.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-[200px] text-center mt-8">
                <div className="text-3xl mb-3">🔍</div>
                <div className="text-sm font-medium text-text-primary mb-1">No results found</div>
                <div className="text-xs text-text-secondary">Try a different search or category</div>
              </div>
            )}

            {hasMore && voices.length > 0 && (
              <div className="flex justify-center mt-6 mb-2">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 rounded text-sm font-medium border border-border hover:border-border-strong text-text-secondary hover:text-text-primary transition-all duration-150 disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <SpinnerIcon />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Voice card ────────────────────────────────────────────────────────────────

function VoiceMarketCard({
  voice,
  dlEntry,
  onGet,
}: {
  voice: MarketVoice
  dlEntry: { downloaded: number; total: number; phase: DownloadPhase } | undefined
  onGet: () => void
}): React.ReactElement {
  const phase = dlEntry?.phase
  const progressPct =
    phase === 'done'
      ? 100
      : phase === 'extracting'
        ? 99
        : dlEntry && dlEntry.total > 0
          ? Math.round((dlEntry.downloaded / dlEntry.total) * 100)
          : 5

  return (
    <div className="group flex flex-col bg-surface rounded-lg border border-border hover:border-border-strong hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-150 overflow-hidden">
      {/* Cover */}
      <div className="aspect-square bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-5xl border-b border-border relative">
        {voice.avatar}
        {voice.epochs && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-canvas/80 text-text-secondary border border-border">
            {voice.epochs}ep
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        <div>
          <div className="font-medium text-sm text-text-primary leading-tight line-clamp-2" title={voice.name}>
            {voice.name}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5">
            <span className="truncate">by {voice.creator}</span>
            {voice.file_size && (
              <>
                <span className="opacity-30">·</span>
                <span className="shrink-0 opacity-60">{voice.file_size}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
            {voice.category}
          </span>
          <span className="text-[10px] text-text-secondary opacity-60">RVC v{voice.rvc_version}</span>
        </div>

        {/* Action */}
        <div className="mt-auto pt-1">
          {!phase && (
            <button
              onClick={onGet}
              disabled={!voice.download_url}
              className={[
                'w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all duration-150',
                voice.download_url
                  ? 'bg-accent text-white hover:bg-accent/85'
                  : 'bg-surface border border-border text-text-secondary cursor-not-allowed opacity-50',
              ].join(' ')}
            >
              {voice.download_url ? (
                <>
                  <DownloadIcon />
                  Get
                </>
              ) : (
                'No download'
              )}
            </button>
          )}

          {(phase === 'starting' || phase === 'downloading' || phase === 'extracting') && (
            <div className="w-full relative h-7 rounded overflow-hidden bg-accent/15">
              <div
                className="absolute inset-y-0 left-0 bg-accent transition-all duration-300"
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white z-10">
                {phase === 'extracting' ? 'Extracting...' : phase === 'starting' ? 'Starting...' : `${progressPct}%`}
              </span>
            </div>
          )}

          {phase === 'done' && (
            <div className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium text-live border border-live/20 bg-live/5">
              <CheckIcon />
              Downloaded
            </div>
          )}

          {phase === 'error' && (
            <button
              onClick={onGet}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const SpinnerIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
)

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
