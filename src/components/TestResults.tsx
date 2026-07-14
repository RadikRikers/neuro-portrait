import { useMemo, useState } from 'react'
import { CONTENT_TYPES, UDMURTIA_ZONES } from '../data/segments'
import type { TextTestResult } from '../types'
import type { AnalysisSettings } from '../utils/analysis-settings'
import { downloadTextFile, exportTestReportTxt } from '../utils/export-report'
import { applyReactionView } from '../utils/sort-reactions'

interface TestResultsProps {
  result: TextTestResult
  reactionSettings: Pick<AnalysisSettings, 'reactionSort' | 'reactionFilter'>
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}%</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function sentimentColor(s: string) {
  if (s === 'positive') return 'text-emerald-400'
  if (s === 'negative') return 'text-rose-400'
  return 'text-amber-400'
}

function severityStyle(s: string) {
  if (s === 'high') return 'border-rose-500/30 bg-rose-500/5'
  if (s === 'medium') return 'border-amber-500/30 bg-amber-500/5'
  return 'border-slate-500/20 bg-surface-3'
}

const CONTENT_LABEL: Record<string, string> = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t.id, t.label]),
)

const COLLAPSE_THRESHOLD = 8
const COLLAPSED_COUNT = 6

export function TestResults({ result, reactionSettings }: TestResultsProps) {
  const [showAllReactions, setShowAllReactions] = useState(false)

  const preview = result.text.trim().slice(0, 280)
  const truncated = result.text.trim().length > 280

  const visibleReactions = useMemo(
    () => applyReactionView(
      result.reactions,
      reactionSettings.reactionSort,
      reactionSettings.reactionFilter,
    ),
    [result.reactions, reactionSettings.reactionSort, reactionSettings.reactionFilter],
  )

  const displayedReactions = showAllReactions || visibleReactions.length <= COLLAPSE_THRESHOLD
    ? visibleReactions
    : visibleReactions.slice(0, COLLAPSED_COUNT)

  const meta = result.analysisMeta

  return (
    <section className="space-y-5 text-left mt-5">
      <div className="glass rounded-2xl p-4 border border-indigo-500/20">
        <p className="text-xs text-indigo-300/80 mb-2">
          3. Результат · {CONTENT_LABEL[result.contentType] ?? result.contentType}
        </p>
        <p className="text-xs text-slate-500 mb-1">Проверенный пост:</p>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {preview}{truncated ? '…' : ''}
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-semibold text-white text-lg">
              {result.label ? `Вариант ${result.label}` : 'Прогноз отклика'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {result.reactions.length} персонажей ·{' '}
              {result.zones.map((z) => UDMURTIA_ZONES.find((u) => u.id === z)?.name ?? z).join(', ')} ·{' '}
              {result.source === 'ollama' ? 'Ollama + эвристика' : 'Эвристический анализ'}
            </p>
            {meta && (
              <p className="text-[10px] text-slate-600 mt-1">
                {meta.segmentCount} сегментов × {meta.portraitsPerSegment} портр.
                {meta.limited
                  ? ` · выборка ${meta.analyzedCount} из ${meta.poolSize}`
                  : ` · полный набор ${meta.poolSize}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              result.federalTraceRisk === 'high' ? 'bg-rose-500/15 text-rose-300' :
              result.federalTraceRisk === 'medium' ? 'bg-amber-500/15 text-amber-300' :
              'bg-emerald-500/15 text-emerald-300'
            }`}>
              Федеральный след: {result.federalTraceRisk === 'high' ? 'высокий' : result.federalTraceRisk === 'medium' ? 'средний' : 'низкий'}
            </div>
            <button
              type="button"
              onClick={() => downloadTextFile(exportTestReportTxt(result), `neuro-portrait-${Date.now()}.txt`)}
              className="px-3 py-1 rounded-lg bg-surface-3 border border-border text-xs text-slate-300 hover:border-indigo-500/50"
            >
              Скачать .txt
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <ScoreRing value={result.overallScore} label="Общий отклик" color="gradient-text" />
          <ScoreRing value={result.aggregateEngagement} label="Вовлечённость" color="text-cyan-400" />
          <ScoreRing value={result.aggregateRelevance} label="Релевантность" color="text-indigo-400" />
          <ScoreRing value={result.aggregateTrust} label="Доверие" color="text-violet-400" />
        </div>

        <p className="text-sm text-slate-400 border-l-2 border-indigo-500/40 pl-3">{result.federalTraceNote}</p>
      </div>

      {result.imageAnalyses?.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-3">Анализ изображений</h3>
          <div className="space-y-3">
            {result.imageAnalyses.map((img) => (
              <div key={img.fileName} className="bg-surface-3 rounded-xl p-4 border border-border/60 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-white font-medium">{img.fileName}</span>
                  <span className="text-indigo-300">{img.udmurtiaFitScore}% · {img.source === 'vision' ? 'AI' : 'эвристика'}</span>
                </div>
                <p className="text-slate-400 text-xs mb-2">{img.width}×{img.height} · {img.aspectLabel} · {img.warmth}</p>
                <p className="text-slate-300">{img.description}</p>
                <p className="text-xs text-amber-300/90 mt-2">{img.textImageSync}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.gaps.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-3">Чего не хватает в тексте</h3>
          <div className="space-y-2">
            {result.gaps.map((gap) => (
              <div key={gap.id} className={`rounded-xl p-4 border ${severityStyle(gap.severity)}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500">{gap.category}</span>
                  {gap.severity === 'high' && <span className="text-[10px] text-rose-400 uppercase">важно</span>}
                </div>
                <p className="text-sm text-white font-medium">{gap.title}</p>
                <p className="text-xs text-slate-400 mt-1">{gap.description}</p>
                <p className="text-xs text-indigo-300 mt-2">→ {gap.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-3">Рекомендации</h3>
          <ul className="space-y-2">
            {result.recommendations.map((r) => (
              <li key={r} className="text-sm text-slate-300 flex gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="font-semibold text-white">Отклик населения</h3>
          {reactionSettings.reactionFilter !== 'all' && (
            <span className="text-[10px] text-slate-500">
              Фильтр: {visibleReactions.length} из {result.reactions.length}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Жители примеряют пост на себя: где увидели, что зацепило, что сделают — не оценка текста редактором
        </p>

        {visibleReactions.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Нет реакций по выбранному фильтру</p>
        ) : (
          <div className="space-y-4">
            {displayedReactions.map((r) => (
              <div key={r.portraitId} className="bg-surface-3 rounded-xl p-4 border border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-white font-medium">{r.name}</span>
                    <span className="text-slate-500 text-sm ml-2">{r.segmentLabel}, {r.age} лет</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={sentimentColor(r.sentiment)}>{r.overallScore}%</span>
                    {r.wouldScrollPast && <span className="text-rose-400">пролистает</span>}
                    {r.wouldComment && <span className="text-cyan-400">прокомментирует</span>}
                    {r.wouldShare && <span className="text-emerald-400">поделится</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-200">
                    {r.emotion}
                  </span>
                  {r.readingContext && (
                    <span className="text-slate-500">{r.readingContext}</span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-1">Примеряет на себя: <span className="text-slate-300">{r.wants}</span></p>
                {r.hookedBy && (
                  <p className="text-sm text-emerald-300/90 mb-1">Зацепило: {r.hookedBy}</p>
                )}
                {r.turnedOffBy && (
                  <p className="text-sm text-rose-300/90 mb-1">Оттолкнуло: {r.turnedOffBy}</p>
                )}
                <p className="text-sm text-amber-200/90 mb-2">{r.firstImpression}</p>
                <p className="text-sm text-slate-300 mb-2">{r.summary}</p>
                <p className="text-sm text-slate-400 italic border-l-2 border-indigo-500/20 pl-3 mb-3">
                  {r.innerMonologue}
                </p>

                <div className="grid sm:grid-cols-3 gap-2 text-xs mb-2">
                  <span className="text-slate-500">Вовлечённость: <span className="text-cyan-300">{r.engagementScore}%</span></span>
                  <span className="text-slate-500">Релевантность: <span className="text-indigo-300">{r.relevanceScore}%</span></span>
                  <span className="text-slate-500">Доверие: <span className="text-violet-300">{r.trustScore}%</span></span>
                </div>

                {r.missingForMe.length > 0 && (
                  <div className="text-xs text-amber-300/90">
                    Оттолкнуло / не нашёл себя: {r.missingForMe.join(' · ')}
                  </div>
                )}
                {r.highlights.length > 0 && (
                  <div className="text-xs text-emerald-400/90 mt-1">
                    Зацепило лично: {r.highlights.join(' · ')}
                  </div>
                )}
              </div>
            ))}

            {!showAllReactions && visibleReactions.length > COLLAPSE_THRESHOLD && (
              <button
                type="button"
                onClick={() => setShowAllReactions(true)}
                className="w-full py-2.5 rounded-xl border border-border text-sm text-indigo-300 hover:bg-indigo-500/10"
              >
                Показать все {visibleReactions.length} реакций
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}