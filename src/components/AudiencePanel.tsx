import { ALL_ZONE_IDS, AUDIENCE_SEGMENTS, UDMURTIA_ZONES } from '../data/segments'
import type { AudienceSegment, AudienceSegmentId, NeuroPortrait, UdmurtiaZone } from '../types'
import { CustomSegmentForm } from './CustomSegmentForm'

interface AudiencePanelProps {
  selectedSegments: AudienceSegmentId[]
  customSegments: AudienceSegment[]
  selectedZones: UdmurtiaZone[]
  portraits: NeuroPortrait[]
  onToggleSegment: (id: AudienceSegmentId) => void
  onToggleZone: (zone: UdmurtiaZone) => void
  onSelectAllZones: () => void
  onSelectAll: () => void
  onAddCustom: (segment: AudienceSegment) => void
  onRemoveCustom: (id: AudienceSegmentId) => void
}

export function AudiencePanel({
  selectedSegments,
  customSegments,
  selectedZones,
  portraits,
  onToggleSegment,
  onToggleZone,
  onSelectAllZones,
  onSelectAll,
  onAddCustom,
  onRemoveCustom,
}: AudiencePanelProps) {
  const allSegments = [...AUDIENCE_SEGMENTS, ...customSegments]
  const allZonesSelected = selectedZones.length === ALL_ZONE_IDS.length

  return (
    <section className="glass rounded-2xl p-5 text-left">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">1. Аудитория</h2>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs text-indigo-300 hover:text-indigo-200"
        >
          Выбрать все
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Города и зоны Удмуртии</span>
          <button
            type="button"
            onClick={onSelectAllZones}
            className={`text-xs transition-colors ${
              allZonesSelected ? 'text-indigo-200' : 'text-indigo-300 hover:text-indigo-200'
            }`}
          >
            Вся Удмуртия
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {UDMURTIA_ZONES.map((z) => {
            const active = selectedZones.includes(z.id)
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => onToggleZone(z.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                    : 'bg-surface-3 border-border text-slate-400 hover:text-white'
                }`}
              >
                {z.name}
              </button>
            )
          })}
        </div>
        {selectedZones.length === 0 && (
          <p className="text-xs text-amber-400/80 mt-2">Выберите хотя бы один город или зону</p>
        )}
        {selectedZones.length > 1 && (
          <p className="text-xs text-slate-500 mt-2">
            {allZonesSelected
              ? 'Республиканский охват — подходит для постов на всю Удмуртию'
              : `Выбрано ${selectedZones.length} зон — текст проверяется на охват всех`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {allSegments.map((seg) => {
          const active = selectedSegments.includes(seg.id)
          return (
            <div key={seg.id} className="relative group">
              <button
                type="button"
                onClick={() => onToggleSegment(seg.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  active
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                    : 'bg-surface-3 border-border text-slate-400 hover:text-white'
                }`}
              >
                {seg.label}
                <span className="text-slate-500 ml-1">{seg.ageRange}</span>
                {seg.isCustom && <span className="text-cyan-500/70 ml-1">★</span>}
              </button>
              {seg.isCustom && (
                <button
                  type="button"
                  onClick={() => onRemoveCustom(seg.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500/80 text-white text-[10px] opacity-0 group-hover:opacity-100"
                  title="Удалить"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      <CustomSegmentForm onAdd={onAddCustom} />

      {portraits.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mt-4">
          {portraits.map((p) => (
            <div key={p.id} className="bg-surface-3 rounded-lg p-3 border border-border/60">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center">
                  {p.name[0]}
                </span>
                <div>
                  <span className="text-sm text-white font-medium">{p.name}, {p.age}</span>
                  <span className="text-xs text-slate-500 ml-2">{p.segmentLabel}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">{p.occupation} · {p.city}</p>
            </div>
          ))}
        </div>
      )}

      {selectedSegments.length === 0 && (
        <p className="text-xs text-amber-400/80 mt-3">Выберите хотя бы один сегмент</p>
      )}
    </section>
  )
}