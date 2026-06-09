import React, { useState } from 'react'
import { MarketplaceCard } from '../components/MarketplaceCard'
import { useAppStore } from '../store/appStore'
import type { MarketplaceVoice, VoiceModel } from '../types'

const SAMPLE_VOICES: MarketplaceVoice[] = [
  { id: 'm1', name: 'Anime Girl', creator: 'voxcraft', category: 'Anime', avatar: '🌸', downloads: 24800, rating: 4.8, preview_url: null, download_url: '' },
  { id: 'm2', name: 'Deep Narrator', creator: 'soundforge', category: 'Masculine', avatar: '🎙️', downloads: 18300, rating: 4.6, preview_url: null, download_url: '' },
  { id: 'm3', name: 'Cyborg Unit', creator: 'aivoice', category: 'Robotic', avatar: '🤖', downloads: 12100, rating: 4.4, preview_url: null, download_url: '' },
  { id: 'm4', name: 'Soft Sage', creator: 'deepdream', category: 'Feminine', avatar: '🍃', downloads: 9700, rating: 4.7, preview_url: null, download_url: '' },
  { id: 'm5', name: 'Pirate King', creator: 'oceanwave', category: 'Character', avatar: '🏴‍☠️', downloads: 7800, rating: 4.3, preview_url: null, download_url: '' },
  { id: 'm6', name: 'Radio Host', creator: 'wavemix', category: 'Masculine', avatar: '📻', downloads: 6400, rating: 4.5, preview_url: null, download_url: '' },
  { id: 'm7', name: 'Witch Coven', creator: 'darkvoice', category: 'Character', avatar: '🧙‍♀️', downloads: 5900, rating: 4.2, preview_url: null, download_url: '' },
  { id: 'm8', name: 'Valley Girl', creator: 'vocaliq', category: 'Feminine', avatar: '💅', downloads: 4300, rating: 4.1, preview_url: null, download_url: '' },
  { id: 'm9', name: 'Elven Archer', creator: 'fantasound', category: 'Character', avatar: '🧝', downloads: 3800, rating: 4.6, preview_url: null, download_url: '' },
  { id: 'm10', name: 'Drill Sergeant', creator: 'militone', category: 'Masculine', avatar: '🪖', downloads: 2700, rating: 4.0, preview_url: null, download_url: '' },
  { id: 'm11', name: 'Pop Star', creator: 'melodyai', category: 'Feminine', avatar: '🎤', downloads: 2100, rating: 4.4, preview_url: null, download_url: '' },
  { id: 'm12', name: 'HAL-9000', creator: 'spacev0x', category: 'Robotic', avatar: '🔴', downloads: 1900, rating: 4.7, preview_url: null, download_url: '' }
]

const CATEGORIES = ['All', 'Anime', 'Masculine', 'Feminine', 'Character', 'Robotic']
const SORT_OPTIONS = ['Most downloaded', 'Highest rated', 'Newest']

export function MarketplacePage(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('Most downloaded')
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  const addModel = useAppStore((s) => s.addModel)

  function handleDownloaded(voice: MarketplaceVoice): void {
    setDownloadedIds((s) => new Set(s).add(voice.id))
    const model: VoiceModel = {
      id: `dl-${voice.id}-${Date.now()}`,
      name: voice.name,
      source_type: 'marketplace',
      file_path: '',
      index_path: null,
      avatar: voice.avatar,
      category: voice.category,
      added_at: new Date().toISOString()
    }
    addModel(model)
  }

  const filtered = SAMPLE_VOICES.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.creator.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || v.category === category
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    if (sort === 'Most downloaded') return b.downloads - a.downloads
    if (sort === 'Highest rated') return b.rating - a.rating
    return 0
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border bg-canvas">
        {/* Search */}
        <div className="relative flex-1 max-w-[280px]">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices..."
            className="w-full bg-surface border border-border hover:border-border-strong focus:border-accent/50 text-text-primary text-xs rounded px-3 py-1.5 pl-8 outline-none transition-colors placeholder:text-text-secondary/40"
          />
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150',
                category === c
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary bg-surface border border-border hover:border-border-strong'
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-surface border border-border hover:border-border-strong text-text-secondary text-xs rounded px-2.5 py-1.5 pr-6 outline-none cursor-pointer focus:border-accent/40 transition-colors"
          >
            {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="shrink-0 px-5 py-2.5">
        <span className="text-xs text-text-secondary">{filtered.length} voices</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filtered.map((voice) => (
            <MarketplaceCard
              key={voice.id}
              voice={voice}
              onDownloaded={handleDownloaded}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <div className="text-3xl mb-3">🔍</div>
            <div className="text-sm font-medium text-text-primary mb-1">No results found</div>
            <div className="text-xs text-text-secondary">Try a different search or category</div>
          </div>
        )}
      </div>
    </div>
  )
}

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)
