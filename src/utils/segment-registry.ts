import { AUDIENCE_SEGMENTS } from '../data/segments'
import type { AudienceSegment, AudienceSegmentId } from '../types'

const STORAGE_KEY = 'neuro-portrait-custom-segments'

export function isCustomSegmentId(id: AudienceSegmentId): boolean {
  return id.startsWith('custom_')
}

export function loadCustomSegments(): AudienceSegment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AudienceSegment[]
    return parsed.map((s) => ({ ...s, isCustom: true }))
  } catch {
    return []
  }
}

export function saveCustomSegments(segments: AudienceSegment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(segments))
}

export function getAllSegments(custom: AudienceSegment[]): AudienceSegment[] {
  return [...AUDIENCE_SEGMENTS, ...custom]
}

export function getSegmentById(id: AudienceSegmentId, custom: AudienceSegment[]): AudienceSegment {
  return getAllSegments(custom).find((s) => s.id === id) ?? custom[0] ?? AUDIENCE_SEGMENTS[0]
}

export function createCustomSegment(input: {
  label: string
  ageRange: string
  description: string
  values: string
  painPoints: string
  languageExpectations: string
}): AudienceSegment {
  const split = (s: string) => s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean)
  const id = `custom_${Date.now()}` as AudienceSegmentId

  return {
    id,
    label: input.label.trim(),
    ageRange: input.ageRange.trim() || '18–50',
    description: input.description.trim() || 'Пользовательский сегмент',
    values: split(input.values).length ? split(input.values) : ['Локальный контекст'],
    painPoints: split(input.painPoints).length ? split(input.painPoints) : ['Шаблонный контент'],
    languageExpectations: split(input.languageExpectations).length
      ? split(input.languageExpectations)
      : ['Понятный язык'],
    channels: ['VK', 'Telegram'],
    engagementTriggers: ['Конкретика', 'Локальные маркеры'],
    rejectionTriggers: ['Федеральный шаблон', 'Вода'],
    isCustom: true,
  }
}