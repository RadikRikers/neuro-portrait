import type { PresetSegmentId } from '../types'

export interface UdmurtiaVoiceProfile {
  segmentId: PresetSegmentId
  researchSources: string[]
  fillers: string[]
  slang: string[]
  localWords: string[]
  sentenceStyle: string
  samplePhrases: string[]
  localPublics: string[]
  localMeme: string
  voiceInstruction: string
}

export interface VoiceReactionTemplate {
  scene: string[]
  hookPositive: string[]
  hookNegative: string[]
  selfLink: string[]
  actionScroll: string[]
  actionShare: string[]
  actionRead: string[]
  actionComment: string[]
}