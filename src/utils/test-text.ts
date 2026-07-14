import type {
  AnalysisMeta,
  AudienceSegment,
  ContentType,
  ImageAnalysis,
  NeuroPortrait,
  TextTestResult,
  UploadedImage,
  UdmurtiaZone,
} from '../types'
import { analyzeImages, imageContextForPrompt } from './image-analyzer'
import { analyzeWithOllama } from './ollama'
import { analyzeTextHeuristic } from './text-analyzer'
import { filterLivedPhrases } from './persona-voice'

export interface TestTextOptions {
  analysisMeta?: AnalysisMeta
  onProgress?: (step: string) => void
}

export async function testText(
  text: string,
  portraits: NeuroPortrait[],
  contentType: ContentType,
  zones: UdmurtiaZone[],
  useOllama: boolean,
  customSegments: AudienceSegment[] = [],
  images: UploadedImage[] = [],
  options: TestTextOptions = {},
): Promise<TextTestResult> {
  const { analysisMeta, onProgress } = options

  onProgress?.(images.length ? 'Анализ изображений…' : 'Эвристический анализ текста…')
  const imageAnalyses: ImageAnalysis[] = images.length
    ? await analyzeImages(images, text, contentType, useOllama)
    : []

  const base = analyzeTextHeuristic(text, portraits, contentType, zones, customSegments, imageAnalyses)
  const withMeta = (r: TextTestResult): TextTestResult =>
    analysisMeta ? { ...r, analysisMeta } : r

  if (!useOllama) return withMeta(base)

  onProgress?.(`AI-реакции персонажей (0/${portraits.length})…`)
  const imageContext = imageContextForPrompt(imageAnalyses)
  const ollamaReactions = await analyzeWithOllama(
    text,
    portraits,
    contentType,
    zones,
    imageContext,
    (done, total) => onProgress?.(`AI-реакции персонажей (${done}/${total})…`),
  )
  if (!ollamaReactions) return withMeta(base)

  const ollamaById = new Map(ollamaReactions.map((r) => [r.portraitId, r]))
  const merged = base.reactions.map((h) => {
    const o = ollamaById.get(h.portraitId)
    if (!o) return h
    return {
      ...o,
      engagementScore: Math.round(h.engagementScore * 0.35 + o.engagementScore * 0.65),
      trustScore: Math.round(h.trustScore * 0.35 + o.trustScore * 0.65),
      relevanceScore: Math.round(h.relevanceScore * 0.35 + o.relevanceScore * 0.65),
      overallScore: Math.round(
        (h.engagementScore * 0.35 + o.engagementScore * 0.65) * 0.4 +
        (h.trustScore * 0.35 + o.trustScore * 0.65) * 0.3 +
        (h.relevanceScore * 0.35 + o.relevanceScore * 0.65) * 0.3,
      ),
      missingForMe: filterLivedPhrases(
        o.missingForMe.length ? o.missingForMe : h.missingForMe,
      ).slice(0, 4),
      highlights: filterLivedPhrases(
        o.highlights.length ? o.highlights : h.highlights,
      ).slice(0, 3),
      emotion: o.emotion || h.emotion,
      wants: o.wants || h.wants,
      firstImpression: o.firstImpression || h.firstImpression,
      readingContext: o.readingContext || h.readingContext,
      hookedBy: o.hookedBy ?? h.hookedBy,
      turnedOffBy: o.turnedOffBy ?? h.turnedOffBy,
      innerMonologue: o.innerMonologue || h.innerMonologue,
      summary: o.summary || h.summary,
    }
  })

  const avg = (fn: (r: typeof merged[0]) => number) =>
    Math.round(merged.reduce((s, r) => s + fn(r), 0) / merged.length)

  return withMeta({
    ...base,
    reactions: merged,
    aggregateEngagement: avg((r) => r.engagementScore),
    aggregateRelevance: avg((r) => r.relevanceScore),
    aggregateTrust: avg((r) => r.trustScore),
    overallScore: avg((r) => r.overallScore),
    source: 'ollama',
  })
}