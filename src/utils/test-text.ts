import type {
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

export async function testText(
  text: string,
  portraits: NeuroPortrait[],
  contentType: ContentType,
  zones: UdmurtiaZone[],
  useOllama: boolean,
  customSegments: AudienceSegment[] = [],
  images: UploadedImage[] = [],
): Promise<TextTestResult> {
  const imageAnalyses: ImageAnalysis[] = images.length
    ? await analyzeImages(images, text, contentType, useOllama)
    : []

  const base = analyzeTextHeuristic(text, portraits, contentType, zones, customSegments, imageAnalyses)

  if (!useOllama) return base

  const imageContext = imageContextForPrompt(imageAnalyses)
  const ollamaReactions = await analyzeWithOllama(text, portraits, contentType, zones, imageContext)
  if (!ollamaReactions) return base

  const merged = base.reactions.map((h, i) => {
    const o = ollamaReactions[i]
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
      missingForMe: [...new Set([...h.missingForMe, ...o.missingForMe])].slice(0, 4),
      highlights: [...new Set([...h.highlights, ...o.highlights])].slice(0, 3),
      innerMonologue: o.innerMonologue || h.innerMonologue,
      summary: o.summary || h.summary,
    }
  })

  const avg = (fn: (r: typeof merged[0]) => number) =>
    Math.round(merged.reduce((s, r) => s + fn(r), 0) / merged.length)

  return {
    ...base,
    reactions: merged,
    aggregateEngagement: avg((r) => r.engagementScore),
    aggregateRelevance: avg((r) => r.relevanceScore),
    aggregateTrust: avg((r) => r.trustScore),
    overallScore: avg((r) => r.overallScore),
    source: 'ollama',
  }
}