import type { CompareResult, TextTestResult } from '../types'

export function compareResults(resultA: TextTestResult, resultB: TextTestResult): CompareResult {
  const overallDelta = resultB.overallScore - resultA.overallScore
  const engagementDelta = resultB.aggregateEngagement - resultA.aggregateEngagement
  const relevanceDelta = resultB.aggregateRelevance - resultA.aggregateRelevance
  const trustDelta = resultB.aggregateTrust - resultA.aggregateTrust

  const winner: CompareResult['winner'] =
    Math.abs(overallDelta) < 3 ? 'tie' : overallDelta > 0 ? 'B' : 'A'

  const personaComparisons = resultA.reactions.map((ra) => {
    const rb = resultB.reactions.find((r) => r.portraitId === ra.portraitId) ?? ra
    const delta = rb.overallScore - ra.overallScore
    const w: 'A' | 'B' | 'tie' = Math.abs(delta) < 3 ? 'tie' : delta > 0 ? 'B' : 'A'

    let note = ''
    if (w === 'B') note = rb.highlights[0] ? `B сильнее: ${rb.highlights[0]}` : 'Вариант B ближе к аудитории'
    else if (w === 'A') note = ra.highlights[0] ? `A сильнее: ${ra.highlights[0]}` : 'Вариант A ближе к аудитории'
    else note = 'Оба варианта примерно равны для этого сегмента'

    return {
      portraitId: ra.portraitId,
      segmentLabel: ra.segmentLabel,
      name: ra.name,
      scoreA: ra.overallScore,
      scoreB: rb.overallScore,
      delta,
      winner: w,
      note,
    }
  })

  const bWins = personaComparisons.filter((p) => p.winner === 'B').length
  const aWins = personaComparisons.filter((p) => p.winner === 'A').length

  const summary =
    winner === 'tie'
      ? `Варианты A и B набрали близкие баллы (разница ${overallDelta} п.п.). A лучше для ${aWins} персонажей, B — для ${bWins}.`
      : winner === 'B'
        ? `Вариант B сильнее на ${Math.abs(overallDelta)} п.п. Лучше для ${bWins} из ${personaComparisons.length} персонажей.`
        : `Вариант A сильнее на ${Math.abs(overallDelta)} п.п. Лучше для ${aWins} из ${personaComparisons.length} персонажей.`

  return {
    resultA: { ...resultA, label: 'A' },
    resultB: { ...resultB, label: 'B' },
    winner,
    overallDelta,
    engagementDelta,
    relevanceDelta,
    trustDelta,
    personaComparisons,
    summary,
  }
}