import type { CompareResult } from '../types'
import { downloadTextFile, exportCompareReportTxt } from '../utils/export-report'

interface CompareResultsProps {
  compare: CompareResult
}

export function CompareResults({ compare }: CompareResultsProps) {
  const winnerLabel =
    compare.winner === 'tie' ? 'Ничья' : `Вариант ${compare.winner} сильнее`

  return (
    <section className="glass rounded-2xl p-5 text-left space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white text-lg">Сравнение A / B</h2>
          <p className="text-sm text-indigo-300 mt-1">{winnerLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadTextFile(exportCompareReportTxt(compare), `compare-${Date.now()}.txt`)}
          className="px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-xs text-slate-300 hover:border-indigo-500/50"
        >
          Скачать .txt
        </button>
      </div>

      <p className="text-sm text-slate-400 border-l-2 border-indigo-500/40 pl-3">{compare.summary}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs">
              <th className="text-left py-2">Метрика</th>
              <th className="text-center py-2">A</th>
              <th className="text-center py-2">B</th>
              <th className="text-center py-2">Δ</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {[
              ['Общий отклик', compare.resultA.overallScore, compare.resultB.overallScore, compare.overallDelta],
              ['Вовлечённость', compare.resultA.aggregateEngagement, compare.resultB.aggregateEngagement, compare.engagementDelta],
              ['Релевантность', compare.resultA.aggregateRelevance, compare.resultB.aggregateRelevance, compare.relevanceDelta],
              ['Доверие', compare.resultA.aggregateTrust, compare.resultB.aggregateTrust, compare.trustDelta],
            ].map(([label, a, b, d]) => (
              <tr key={label as string} className="border-t border-border/40">
                <td className="py-2 text-slate-400">{label}</td>
                <td className="text-center py-2">{a}%</td>
                <td className="text-center py-2">{b}%</td>
                <td className={`text-center py-2 font-medium ${(d as number) > 0 ? 'text-emerald-400' : (d as number) < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {(d as number) > 0 ? '+' : ''}{d}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white">По персонажам</h3>
        {compare.personaComparisons.map((p) => (
          <div key={p.portraitId} className="bg-surface-3 rounded-lg p-3 border border-border/50 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-white">{p.name} · {p.segmentLabel}</span>
              <span className={
                p.winner === 'B' ? 'text-emerald-400' : p.winner === 'A' ? 'text-cyan-400' : 'text-slate-500'
              }>
                {p.winner === 'tie' ? '≈' : p.winner}: {p.scoreA}% → {p.scoreB}%
              </span>
            </div>
            <p className="text-slate-500">{p.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}