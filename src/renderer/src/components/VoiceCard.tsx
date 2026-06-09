import React from 'react'
import type { VoiceModel } from '../types'

interface Props {
  model: VoiceModel
  isSelected: boolean
  isBuiltIn?: boolean
  onSelect: () => void
  onDelete: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  Character: 'text-accent bg-accent-dim',
  Masculine: 'text-blue-400 bg-blue-400/10',
  Feminine: 'text-pink-400 bg-pink-400/10',
  Anime: 'text-purple-400 bg-purple-400/10',
  Robotic: 'text-cyan-400 bg-cyan-400/10',
  Custom: 'text-text-secondary bg-[rgba(255,255,255,0.06)]'
}

export function VoiceCard({ model, isSelected, isBuiltIn, onSelect, onDelete }: Props): React.ReactElement {
  return (
    <div
      onClick={onSelect}
      className={[
        'group relative flex flex-col items-center gap-3 p-4 rounded-lg cursor-pointer',
        'bg-surface transition-all duration-150 select-none',
        isSelected
          ? 'border-2 border-accent shadow-accent'
          : 'border border-border hover:border-border-strong hover:-translate-y-0.5 hover:shadow-card-hover'
      ].join(' ')}
    >
      {/* Delete button — hidden for built-in voices */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={[
          'absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center',
          'hover:bg-[rgba(255,255,255,0.08)] text-text-secondary hover:text-text-primary transition-all duration-150',
          isBuiltIn ? 'hidden' : 'opacity-0 group-hover:opacity-100'
        ].join(' ')}
        title="Remove model"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Avatar */}
      <div
        className={[
          'w-14 h-14 rounded-xl flex items-center justify-center text-2xl',
          'bg-[rgba(255,255,255,0.04)] border border-border transition-transform duration-150',
          'group-hover:scale-105'
        ].join(' ')}
      >
        {model.avatar}
      </div>

      {/* Name */}
      <span className="text-sm font-medium text-text-primary text-center leading-tight line-clamp-2">
        {model.name}
      </span>

      {/* Category tag */}
      <span
        className={[
          'px-2 py-0.5 rounded-full text-2xs font-medium uppercase tracking-wide',
          CATEGORY_COLORS[model.category] ?? CATEGORY_COLORS.Custom
        ].join(' ')}
      >
        {model.category}
      </span>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      )}
    </div>
  )
}

export function ImportCard({ onImport }: { onImport: () => void }): React.ReactElement {
  return (
    <div
      onClick={onImport}
      className={[
        'flex flex-col items-center justify-center gap-2 p-4 rounded-lg cursor-pointer',
        'border border-dashed border-border-strong hover:border-accent/40 hover:bg-accent-dim',
        'transition-all duration-150 min-h-[140px] text-text-secondary hover:text-accent'
      ].join(' ')}
    >
      <div className="w-10 h-10 rounded-xl border border-dashed border-current flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5v14" />
        </svg>
      </div>
      <span className="text-sm font-medium text-center">Import model</span>
      <span className="text-xs text-center opacity-70">.pth or .index</span>
    </div>
  )
}
