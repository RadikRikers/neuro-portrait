export type PresetSegmentId =
  | 'school'
  | 'student'
  | 'young_pro'
  | 'worker'
  | 'parent'
  | 'kindergarten_parent'
  | 'senior'
  | 'rural'
  | 'udmurt_speaker'

export type AudienceSegmentId = PresetSegmentId | `custom_${string}`

export type UdmurtiaZone = 'izhevsk' | 'sarapul' | 'votkinsk' | 'glazov' | 'mozhga' | 'rural'

export type ContentType = 'post' | 'stories' | 'article' | 'ad' | 'other'

export type TestMode = 'single' | 'compare'

export interface AudienceSegment {
  id: AudienceSegmentId
  label: string
  ageRange: string
  description: string
  values: string[]
  painPoints: string[]
  languageExpectations: string[]
  channels: string[]
  engagementTriggers: string[]
  rejectionTriggers: string[]
  isCustom?: boolean
}

export interface NeuroPortrait {
  id: string
  segmentId: AudienceSegmentId
  segmentLabel: string
  name: string
  age: number
  city: string
  occupation: string
  bio: string
  favoritePlace: string
  values: string[]
  painPoints: string[]
  languageStyle: string
  channels: string[]
}

export interface UploadedImage {
  id: string
  name: string
  previewUrl: string
  base64: string
  mimeType: string
}

export interface ImageAnalysis {
  fileName: string
  width: number
  height: number
  aspectLabel: string
  brightness: 'тёмное' | 'среднее' | 'светлое'
  warmth: 'холодные тона' | 'нейтральные' | 'тёплые тона'
  description: string
  localMarkers: string[]
  warnings: string[]
  textImageSync: string
  udmurtiaFitScore: number
  source: 'vision' | 'heuristic'
}

export interface TextGap {
  id: string
  severity: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  suggestion: string
}

export interface PersonaReaction {
  portraitId: string
  segmentLabel: string
  name: string
  age: number
  engagementScore: number
  trustScore: number
  relevanceScore: number
  overallScore: number
  sentiment: 'positive' | 'neutral' | 'negative'
  emotion: string
  wants: string
  firstImpression: string
  summary: string
  innerMonologue: string
  wouldShare: boolean
  wouldComment: boolean
  wouldScrollPast: boolean
  missingForMe: string[]
  highlights: string[]
}

export interface TextTestResult {
  label?: string
  text: string
  contentType: ContentType
  zones: UdmurtiaZone[]
  testedAt: string
  aggregateEngagement: number
  aggregateRelevance: number
  aggregateTrust: number
  overallScore: number
  federalTraceRisk: 'low' | 'medium' | 'high'
  federalTraceNote: string
  reactions: PersonaReaction[]
  gaps: TextGap[]
  recommendations: string[]
  imageAnalyses: ImageAnalysis[]
  source: 'ollama' | 'heuristic'
}

export interface PersonaComparison {
  portraitId: string
  segmentLabel: string
  name: string
  scoreA: number
  scoreB: number
  delta: number
  winner: 'A' | 'B' | 'tie'
  note: string
}

export interface CompareResult {
  resultA: TextTestResult
  resultB: TextTestResult
  winner: 'A' | 'B' | 'tie'
  overallDelta: number
  engagementDelta: number
  relevanceDelta: number
  trustDelta: number
  personaComparisons: PersonaComparison[]
  summary: string
}