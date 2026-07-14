import { UDMURTIA_ZONES } from '../data/segments'
import type { CompareResult, ImageAnalysis, TextTestResult } from '../types'

function zoneNames(ids: string[]): string {
  if (!ids.length) return 'Ижевск'
  return ids.map((id) => UDMURTIA_ZONES.find((z) => z.id === id)?.name ?? id).join(', ')
}

function riskLabel(r: string): string {
  return r === 'high' ? 'высокий' : r === 'medium' ? 'средний' : 'низкий'
}

function formatImages(images: ImageAnalysis[]): string {
  if (!images.length) return 'Изображения не прикреплены.\n'
  return images.map((img) => `
--- ${img.fileName} (${img.width}x${img.height}) ---
Формат: ${img.aspectLabel}
Яркость: ${img.brightness} | Тона: ${img.warmth}
Оценка для Удмуртии: ${img.udmurtiaFitScore}%
Источник анализа: ${img.source === 'vision' ? 'нейросеть (vision)' : 'эвристика'}
Описание: ${img.description}
Связка с текстом: ${img.textImageSync}
Локальные маркеры: ${img.localMarkers.join(', ') || 'не найдены'}
Замечания: ${img.warnings.join('; ') || 'нет'}
`).join('\n')
}

export function exportTestReportTxt(result: TextTestResult): string {
  const title = result.label ? `Вариант ${result.label}` : 'Анализ контента'
  const lines: string[] = [
    'НЕЙРОПОРТРЕТ · УДМУРТИЯ',
    'Отчёт по тестированию контента',
    '='.repeat(50),
    '',
    title,
    `Дата: ${new Date(result.testedAt).toLocaleString('ru-RU')}`,
    `Зоны: ${zoneNames(result.zones)}`,
    `Тип контента: ${result.contentType}`,
    `Анализ: ${result.source === 'ollama' ? 'Ollama + эвристика' : 'Эвристика (работает на Vercel)'}`,
    '',
    '--- СВОДКА ---',
    `Общий отклик:      ${result.overallScore}%`,
    `Вовлечённость:     ${result.aggregateEngagement}%`,
    `Релевантность:     ${result.aggregateRelevance}%`,
    `Доверие:           ${result.aggregateTrust}%`,
    `Федеральный след:  ${riskLabel(result.federalTraceRisk)}`,
    result.federalTraceNote,
    '',
    '--- ТЕКСТ ---',
    result.text,
    '',
    '--- ИЗОБРАЖЕНИЯ ---',
    formatImages(result.imageAnalyses),
    '',
    '--- ЧЕГО НЕ ХВАТАЕТ ---',
    ...result.gaps.map((g) => `[${g.severity.toUpperCase()}] ${g.title}\n  ${g.suggestion}`),
    result.gaps.length ? '' : 'Критичных пробелов не выявлено.',
    '',
    '--- РЕКОМЕНДАЦИИ ---',
    ...result.recommendations.map((r, i) => `${i + 1}. ${r}`),
    '',
    '--- ОТКЛИК ПО ПЕРСОНАЖАМ ---',
  ]

  for (const r of result.reactions) {
    lines.push(
      '',
      `${r.name} (${r.segmentLabel}, ${r.age} лет) — ${r.overallScore}%`,
      `Эмоция: ${r.emotion}`,
      `Хочет: ${r.wants}`,
      `Первое впечатление: «${r.firstImpression}»`,
      `Прогноз: ${r.summary}`,
      `Мысли: ${r.innerMonologue}`,
      `Вовлечённость ${r.engagementScore}% | Релевантность ${r.relevanceScore}% | Доверие ${r.trustScore}%`,
      `Поведение: ${[
        r.wouldShare ? 'поделится' : null,
        r.wouldComment ? 'прокомментирует' : null,
        r.wouldScrollPast ? 'пролистает' : null,
      ].filter(Boolean).join(', ') || 'нейтрально'}`,
      `Не хватает: ${r.missingForMe.join('; ') || '—'}`,
      `Сработало: ${r.highlights.join('; ') || '—'}`,
    )
  }

  lines.push('', '='.repeat(50), 'Сгенерировано: neuro-portrait.vercel.app')
  return lines.join('\n')
}

export function exportCompareReportTxt(compare: CompareResult): string {
  const header = [
    'НЕЙРОПОРТРЕТ · СРАВНЕНИЕ A / B',
    '='.repeat(50),
    `Дата: ${new Date(compare.resultA.testedAt).toLocaleString('ru-RU')}`,
    `Зоны: ${zoneNames(compare.resultA.zones)}`,
    `Победитель: ${compare.winner === 'tie' ? 'Ничья' : `Вариант ${compare.winner}`}`,
    compare.summary,
    '',
    'Метрика              A      B      Разница',
    `Общий отклик         ${compare.resultA.overallScore}%    ${compare.resultB.overallScore}%    ${compare.overallDelta > 0 ? '+' : ''}${compare.overallDelta}%`,
    `Вовлечённость        ${compare.resultA.aggregateEngagement}%    ${compare.resultB.aggregateEngagement}%    ${compare.engagementDelta > 0 ? '+' : ''}${compare.engagementDelta}%`,
    `Релевантность        ${compare.resultA.aggregateRelevance}%    ${compare.resultB.aggregateRelevance}%    ${compare.relevanceDelta > 0 ? '+' : ''}${compare.relevanceDelta}%`,
    `Доверие              ${compare.resultA.aggregateTrust}%    ${compare.resultB.aggregateTrust}%    ${compare.trustDelta > 0 ? '+' : ''}${compare.trustDelta}%`,
    '',
    '--- ПО ПЕРСОНАЖАМ ---',
    ...compare.personaComparisons.map((p) =>
      `${p.name} (${p.segmentLabel}): A ${p.scoreA}% → B ${p.scoreB}% — лучше ${p.winner === 'tie' ? '≈' : p.winner}. ${p.note}`,
    ),
    '',
    '='.repeat(50),
    '',
    exportTestReportTxt({ ...compare.resultA, label: 'A' }),
    '',
    '='.repeat(50),
    '',
    exportTestReportTxt({ ...compare.resultB, label: 'B' }),
  ]
  return header.join('\n')
}

export function downloadTextFile(content: string, filename: string): void {
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`
  a.click()
  URL.revokeObjectURL(url)
}