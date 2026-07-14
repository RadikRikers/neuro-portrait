import { ALL_PRESET_SEGMENT_IDS, AUDIENCE_SEGMENTS, SEGMENT_GROUPS, UDMURTIA_ZONES } from '../data/segments'
import type { AudienceSegment, AudienceSegmentId, NeuroPortrait, PresetSegmentId, UdmurtiaZone } from '../types'
import type { AnalysisSettings } from '../utils/analysis-settings'
import { estimatePortraitCount } from '../utils/analysis-settings'
import { AnalysisSettingsPanel } from './AnalysisSettingsPanel'
import { CustomSegmentForm } from './CustomSegmentForm'

interface AudiencePanelProps {
  selectedSegments: AudienceSegmentId[]
  customSegments: AudienceSegment[]
  selectedZones: UdmurtiaZone[]
  portraits: NeuroPortrait[]
  analysisSettings: AnalysisSettings
  onAnalysisSettingsChange: (settings: AnalysisSettings) => void
  onToggleSegment: (id: AudienceSegmentId) => void
  onToggleZone: (zone: UdmurtiaZone) => void
  onSelectAllZones: () => void
  onSelectAll: () => void
  onSelectGroup: (ids: PresetSegmentId[]) => void
  onAddCustom: (segment: AudienceSegment) => void
  onRemoveCustom: (id: AudienceSegmentId) => void
}

const SVO_SEGMENTS: PresetSegmentId[] = [
  'svo_participant', 'svo_veteran', 'svo_family_spouse', 'svo_family_parent',
]

export function AudiencePanel({
  selectedSegments,
  customSegments,
  selectedZones,
  portraits,
  analysisSettings,
  onAnalysisSettingsChange,
  onToggleSegment,
  onToggleZone,
  onSelectAllZones,
  onSelectAll,
  onSelectGroup,
  onAddCustom,
  onRemoveCustom,
}: AudiencePanelProps) {
  const allSegments = [...AUDIENCE_SEGMENTS, ...customSegments]
  const segmentById = Object.fromEntries(allSegments.map((s) => [s.id, s]))
  const allZonesSelected = selectedZones.length === UDMURTIA_ZONES.length
  const { generated, analyzed } = estimatePortraitCount(selectedSegments.length, analysisSettings)

  return (
    <section className="glass rounded-2xl p-5 text-left">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-white">1. Аудитория</h2>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs text-indigo-300 hover:text-indigo-200"
        >
          Все сегменты
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        {selectedSegments.length} сегментов · {portraits.length} портретов
        ({analysisSettings.portraitsPerSegment} на сегмент)
        {analyzed < generated && ` · в тесте ${analyzed}`}
      </p>

      <AnalysisSettingsPanel
        settings={analysisSettings}
        segmentCount={selectedSegments.length}
        onChange={onAnalysisSettingsChange}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => onSelectGroup(SVO_SEGMENTS)}
          className="px-2.5 py-1 rounded-md text-[11px] border border-rose-500/30 text-rose-200/90 hover:bg-rose-500/10"
        >
          СВО и семьи
        </button>
        <button
          type="button"
          onClick={() => onSelectGroup(['opposition', 'patriot_loyalist'])}
          className="px-2.5 py-1 rounded-md text-[11px] border border-amber-500/30 text-amber-200/90 hover:bg-amber-500/10"
        >
          Политический спектр
        </button>
        <button
          type="button"
          onClick={() => onSelectGroup(ALL_PRESET_SEGMENT_IDS)}
          className="px-2.5 py-1 rounded-md text-[11px] border border-indigo-500/30 text-indigo-200/90 hover:bg-indigo-500/10"
        >
          Полный набор ({ALL_PRESET_SEGMENT_IDS.length})
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
      </div>

      <div className="space-y-3 mb-2 max-h-72 overflow-y-auto pr-1">
        {SEGMENT_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.segmentIds.map((id) => {
                const seg = segmentById[id]
                if (!seg) return null
                const active = selectedSegments.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleSegment(id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      active
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                        : 'bg-surface-3 border-border text-slate-400 hover:text-white'
                    }`}
                  >
                    {seg.label}
                    <span className="text-slate-500 ml-1">{seg.ageRange}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {customSegments.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Свои сегменты</p>
            <div className="flex flex-wrap gap-2">
              {customSegments.map((seg) => {
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
                      <span className="text-cyan-500/70 ml-1">★</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveCustom(seg.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500/80 text-white text-[10px] opacity-0 group-hover:opacity-100"
                      title="Удалить"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <CustomSegmentForm onAdd={onAddCustom} />

      {portraits.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 mt-4">
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
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.bio}</p>
              {p.speechMarkers && p.speechMarkers.length > 0 && (
                <p className="text-[10px] text-indigo-300/70 mt-1">
                  Голос: {p.speechMarkers.slice(0, 5).join(' · ')}
                </p>
              )}
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