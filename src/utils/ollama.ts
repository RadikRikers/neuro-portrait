import { UDMURTIA_ZONES } from '../data/segments'
import type { NeuroPortrait, PersonaReaction, UdmurtiaZone } from '../types'

const API_BASE = import.meta.env.VITE_OLLAMA_API ?? '/api/ollama'

const VISION_MODELS = ['llava', 'moondream', 'llama3.2-vision', 'bakllava', 'minicpm-v']

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
    const data = await res.json()
    return Array.isArray(data.models) && data.models.length > 0
  } catch {
    return false
  }
}

export async function getAvailableModels(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.models ?? []).map((m: { name: string }) => m.name.split(':')[0])
  } catch {
    return []
  }
}

export async function pickVisionModel(): Promise<string | null> {
  const models = await getAvailableModels()
  for (const preferred of VISION_MODELS) {
    const found = models.find((m) => m.includes(preferred))
    if (found) return found
  }
  return null
}

export async function describeImageWithVision(
  base64: string,
  _mimeType: string,
  context: string,
): Promise<string | null> {
  const model = await pickVisionModel()
  if (!model) return null

  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Опиши изображение для анализа контента об Удмуртии. Контекст: ${context}.
Ответь на русском, 3-5 предложений: что на фото, настроение, цвета, есть ли локальный/удмуртский контекст, подходит ли для соцсетей.`,
        images: [base64],
        stream: false,
        options: { temperature: 0.3, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.response?.trim() || null
  } catch {
    return null
  }
}

export async function analyzeWithOllama(
  text: string,
  portraits: NeuroPortrait[],
  contentType: string,
  zones: UdmurtiaZone[],
  imageContext = '',
): Promise<PersonaReaction[] | null> {
  const personaBriefs = portraits.map((p) =>
    `- ${p.name}, ${p.age} лет, ${p.segmentLabel}, ${p.city}: ${p.bio}. Ценности: ${p.values.join(', ')}. Боли: ${p.painPoints.join(', ')}`,
  ).join('\n')

  const imageBlock = imageContext
    ? `\nВизуал (изображение к посту):\n"""\n${imageContext}\n"""\nОцени связку текст + картинка.`
    : ''

  const zoneLabel = zones.length
    ? zones.map((z) => UDMURTIA_ZONES.find((u) => u.id === z)?.name ?? z).join(', ')
    : 'Ижевск'

  const prompt = `Ты симулируешь реакцию жителей Удмуртии на контент (текст и при наличии — изображение). Ответь ТОЛЬКО валидным JSON-массивом без markdown.

Персонажи:
${personaBriefs}

Тип контента: ${contentType}
Зоны охвата: ${zoneLabel}${zones.length > 1 ? ' (пост может быть на всю республику — учитывай все выбранные города)' : ''}

Текст:
"""
${text}
"""
${imageBlock}

Для КАЖДОГО персонажа (в том же порядке) верни объект:
{
  "portraitId": "id",
  "engagementScore": 0-100,
  "trustScore": 0-100,
  "relevanceScore": 0-100,
  "sentiment": "positive"|"neutral"|"negative",
  "summary": "прогноз отклика",
  "innerMonologue": "2-3 предложения от первого лица",
  "wouldShare": boolean,
  "wouldComment": boolean,
  "wouldScrollPast": boolean,
  "missingForMe": ["чего не хватает"],
  "highlights": ["что сработало"]
}

IDs: ${portraits.map((p) => p.id).join(', ')}`

  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: import.meta.env.VITE_OLLAMA_MODEL ?? 'llama3.2',
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.4, num_predict: 2500 },
      }),
      signal: AbortSignal.timeout(90000),
    })

    if (!res.ok) return null

    const data = await res.json()
    const raw = data.response?.trim()
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const items = Array.isArray(parsed) ? parsed : parsed.reactions ?? parsed.personas ?? [parsed]

    return portraits.map((p, i) => {
      const item = items.find((x: { portraitId?: string }) => x.portraitId === p.id) ?? items[i] ?? {}
      const engagement = clamp(item.engagementScore ?? 50)
      const trust = clamp(item.trustScore ?? 50)
      const relevance = clamp(item.relevanceScore ?? 50)
      const overall = clamp(engagement * 0.4 + trust * 0.3 + relevance * 0.3)

      return {
        portraitId: p.id,
        segmentLabel: p.segmentLabel,
        name: p.name,
        age: p.age,
        engagementScore: engagement,
        trustScore: trust,
        relevanceScore: relevance,
        overallScore: overall,
        sentiment: item.sentiment ?? (overall >= 65 ? 'positive' : overall >= 45 ? 'neutral' : 'negative'),
        summary: item.summary ?? 'Анализ недоступен',
        innerMonologue: item.innerMonologue ?? '',
        wouldShare: Boolean(item.wouldShare),
        wouldComment: Boolean(item.wouldComment),
        wouldScrollPast: Boolean(item.wouldScrollPast),
        missingForMe: Array.isArray(item.missingForMe) ? item.missingForMe : [],
        highlights: Array.isArray(item.highlights) ? item.highlights : [],
      }
    })
  } catch {
    return null
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
}