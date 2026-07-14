import {
  estimatePortraitCount,
  MAX_PORTRAITS_OPTIONS,
  PORTRAITS_PER_SEGMENT_OPTIONS,
  REACTION_FILTER_OPTIONS,
  REACTION_SORT_OPTIONS,
  type AnalysisSettings,
} from '../utils/analysis-settings'

interface AnalysisSettingsPanelProps {
  settings: AnalysisSettings
  segmentCount: number
  onChange: (settings: AnalysisSettings) => void
}

function OptionPills<T extends string | number | null>({
  options,
  value,
  onSelect,
}: {
  options: { value: T; label: string }[]
  value: T
  onSelect: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              active
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                : 'bg-surface-3 border-border text-slate-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function AnalysisSettingsPanel({
  settings,
  segmentCount,
  onChange,
}: AnalysisSettingsPanelProps) {
  const { generated, analyzed } = estimatePortraitCount(segmentCount, settings)
  const limited = analyzed < generated

  const patch = (partial: Partial<AnalysisSettings>) =>
    onChange({ ...settings, ...partial })

  return (
    <div className="rounded-xl border border-border/60 bg-surface-3/50 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
          Настройки анализа
        </h3>
        <span className="text-[10px] text-slate-500">
          {segmentCount} сегм. → {generated} портр.
          {limited && ` · тест на ${analyzed}`}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Портретов на сегмент</p>
          <OptionPills
            options={PORTRAITS_PER_SEGMENT_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
            value={settings.portraitsPerSegment}
            onSelect={(v) => patch({ portraitsPerSegment: v })}
          />
        </div>

        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Макс. портретов в тесте</p>
          <OptionPills
            options={MAX_PORTRAITS_OPTIONS}
            value={settings.maxPortraitsForTest}
            onSelect={(v) => patch({ maxPortraitsForTest: v })}
          />
          {limited && (
            <p className="text-[10px] text-amber-400/80 mt-1.5">
              Выборка равномерная по сегментам — каждый сегмент представлен
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-border/40">
          <p className="text-[11px] text-slate-500 mb-1.5">Отображение реакций</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div>
              <span className="text-[10px] text-slate-600 block mb-1">Сортировка</span>
              <OptionPills
                options={REACTION_SORT_OPTIONS}
                value={settings.reactionSort}
                onSelect={(v) => patch({ reactionSort: v })}
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-600 block mb-1">Фильтр</span>
              <OptionPills
                options={REACTION_FILTER_OPTIONS}
                value={settings.reactionFilter}
                onSelect={(v) => patch({ reactionFilter: v })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}