export type PortraitsPerSegment = 1 | 2 | 3 | 5

export type ReactionSort = 'score_desc' | 'segment' | 'sentiment'
export type ReactionFilter = 'all' | 'negative' | 'neutral' | 'positive'

export interface AnalysisSettings {
  portraitsPerSegment: PortraitsPerSegment
  /** null = без лимита, анализировать всех сгенерированных */
  maxPortraitsForTest: number | null
  reactionSort: ReactionSort
  reactionFilter: ReactionFilter
}

export const PORTRAITS_PER_SEGMENT_OPTIONS: PortraitsPerSegment[] = [1, 2, 3, 5]

export const MAX_PORTRAITS_OPTIONS: { value: number | null; label: string }[] = [
  { value: 12, label: '12' },
  { value: 24, label: '24' },
  { value: 36, label: '36' },
  { value: 50, label: '50' },
  { value: null, label: 'Все' },
]

export const REACTION_SORT_OPTIONS: { value: ReactionSort; label: string }[] = [
  { value: 'score_desc', label: 'По отклику' },
  { value: 'segment', label: 'По сегменту' },
  { value: 'sentiment', label: 'По настроению' },
]

export const REACTION_FILTER_OPTIONS: { value: ReactionFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'positive', label: 'Позитив' },
  { value: 'neutral', label: 'Нейтрал' },
  { value: 'negative', label: 'Негатив' },
]

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  portraitsPerSegment: 2,
  maxPortraitsForTest: 24,
  reactionSort: 'score_desc',
  reactionFilter: 'all',
}

const STORAGE_KEY = 'neuro-portrait-analysis-settings'

export function loadAnalysisSettings(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_ANALYSIS_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AnalysisSettings>
    return {
      ...DEFAULT_ANALYSIS_SETTINGS,
      ...parsed,
      portraitsPerSegment: PORTRAITS_PER_SEGMENT_OPTIONS.includes(parsed.portraitsPerSegment as PortraitsPerSegment)
        ? (parsed.portraitsPerSegment as PortraitsPerSegment)
        : DEFAULT_ANALYSIS_SETTINGS.portraitsPerSegment,
    }
  } catch {
    return { ...DEFAULT_ANALYSIS_SETTINGS }
  }
}

export function saveAnalysisSettings(settings: AnalysisSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function estimatePortraitCount(segmentCount: number, settings: AnalysisSettings): {
  generated: number
  analyzed: number
} {
  const generated = segmentCount * settings.portraitsPerSegment
  const analyzed = settings.maxPortraitsForTest == null
    ? generated
    : Math.min(generated, settings.maxPortraitsForTest)
  return { generated, analyzed }
}