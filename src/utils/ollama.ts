import { UDMURTIA_ZONES } from '../data/segments'
import { formatVoiceBrief, getVoiceProfile, isPresetSegment } from '../data/udmurtia-voices'
import type { NeuroPortrait, PersonaReaction, UdmurtiaZone } from '../types'
import { filterLivedPhrases, isEditorVoice, stylizeForSegment } from './persona-voice'

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

const OLLAMA_BATCH_SIZE = 8

async function analyzePortraitBatch(
  text: string,
  portraits: NeuroPortrait[],
  contentType: string,
  zones: UdmurtiaZone[],
  imageContext: string,
): Promise<PersonaReaction[] | null> {
  const personaBriefs = portraits.map((p) => {
    const voice = isPresetSegment(p.segmentId) ? getVoiceProfile(p.segmentId) : null
    const voiceBlock = voice ? `\n  ГОЛОС (обязательно соблюдай):\n  ${formatVoiceBrief(voice).split('\n').join('\n  ')}` : ''
    return `- ID ${p.id}: ${p.name}, ${p.age} лет, ${p.segmentLabel}, ${p.city}, ${p.occupation}. ${p.bio}
  Паблики: ${p.localPublics?.join(', ') ?? '—'}. Мем: ${p.localMeme ?? '—'}. Любимое место: ${p.favoritePlace}.
  Ценности: ${p.values.join(', ')}. Боли: ${p.painPoints.join(', ')}. Каналы: ${p.channels.join(', ')}.${voiceBlock}`
  }).join('\n')

  const imageBlock = imageContext
    ? `\nВизуал (изображение к посту):\n"""\n${imageContext}\n"""\nОцени связку текст + картинка.`
    : ''

  const zoneLabel = zones.length
    ? zones.map((z) => UDMURTIA_ZONES.find((u) => u.id === z)?.name ?? z).join(', ')
    : 'Ижевск'

  const prompt = `Ты — НЕ редактор и НЕ маркетолог. Ты конкретный житель Удмуртии из карточки персонажа. Автор поста хочет узнать, как РЕАЛЬНО отреагирует население на его публикацию.

Твоя задача: ПРИМЕРИТЬ текст на себя — прочитать как живой человек в ленте, а не оценивать качество текста.

ЗАПРЕЩЕНО (это язык редактора, автор это и так знает):
- «текст слишком длинный», «нет CTA», «нужна локальность», «добавьте вопрос»
- «нет призыва к действию», «инфопост», «для школьников нужен…»
- любые советы автору — только СВОЯ реакция

ОБЯЗАТЕЛЬНО для каждого персонажа:
1. readingContext — где увидел (VK, WhatsApp, Telegram — из каналов персонажа).
2. hookedBy / turnedOffBy — дословная цитата 1–2 фраз ИЗ ТЕКСТА в «кавычках», что зацепило или оттолкнуло ЛИЧНО ЕГО.
3. wants — как примеряет на себя: «это про мой Ижевск», «про моего ребёнка в садике», «не про меня, я в селе».
4. innerMonologue — монолог от первого лица: где увидел → цитата → эмоция → что сделает (пролистает / дочитает / перешлёт маме).
5. РЕЧЬ — живой язык сегмента из блока ГОЛОС: слова-паразиты, сленг, региональные слова. НЕ литературный русский.
   - Школьник: «ну типа», «короче», «кринж», «имба», «жиза»
   - Студент: «если честно», «зашло», «душно», «тильт»
   - Рабочий: «ну», «вот», «по делу», «мульда», «трезвак»
   - Родитель: «ну вот», «подскажите», «мамочки»
   - Пенсионер: «вот», «значит», «э-э», без сленга
   - Сельский: «соседям скину», «опять только ижевск»
   - Удмурт: «вожкы», «пельме», «ар уды»
6. innerMonologue и firstImpression — как комментарий в соцсети этим голосом, не как статья.

Персонажи:
${personaBriefs}

Тип контента: ${contentType}${contentType === 'post' ? ' (информационный — призыв к действию НЕ обязателен, оценивай факты, ясность, локальный контекст)' : ''}
Зоны охвата: ${zoneLabel}${zones.length > 1 ? ' (пост на всю республику — смотри, видит ли себя житель каждого города)' : ''}

Текст:
"""
${text}
"""
${imageBlock}

Ответь ТОЛЬКО валидным JSON-массивом без markdown. Для КАЖДОГО персонажа (в том же порядке):
{
  "portraitId": "id",
  "engagementScore": 0-100,
  "trustScore": 0-100,
  "relevanceScore": 0-100,
  "sentiment": "positive"|"neutral"|"negative",
  "emotion": "одно слово: интерес|скепсис|тревога|раздражение|гордость|равнодушие|...",
  "readingContext": "где увидел пост — одна фраза",
  "hookedBy": "цитата из текста «…» или null",
  "turnedOffBy": "цитата из текста «…» или null",
  "wants": "как примеряет на себя — одно предложение от первого лица",
  "firstImpression": "первая живая мысль при виде поста, со сценой (где увидел)",
  "summary": "для автора: имя, город, что сделает + какая формулировка сработала/нет",
  "innerMonologue": "4–5 предложений от первого лица: где увидел → цитата → моя реакция → что сделаю",
  "wouldShare": boolean,
  "wouldComment": boolean,
  "wouldScrollPast": boolean,
  "missingForMe": ["что в формулировках оттолкнуло лично меня — не советы автору"],
  "highlights": ["какие фразы/контекст зацепили лично меня"]
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
        options: { temperature: 0.4, num_predict: Math.min(6000, 500 + portraits.length * 450) },
      }),
      signal: AbortSignal.timeout(Math.min(180000, 60000 + portraits.length * 8000)),
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

      const sentiment = item.sentiment ?? (overall >= 65 ? 'positive' : overall >= 45 ? 'neutral' : 'negative')

      const readingContext = item.readingContext
        ?? (p.channels[0] ? `Увидел в ${p.channels[0]}` : 'Натыкнулся в ленте')
      const wants = stylizeForSegment(
        p,
        sanitizeField(item.wants) ?? 'пока не понимаю, при чём тут я',
        p.id + 'w',
      )
      const firstImpression = stylizeForSegment(
        p,
        sanitizeField(item.firstImpression)
          ?? (item.hookedBy ? `зацепило: ${item.hookedBy}` : 'натыкаюсь на пост в ленте'),
        p.id + 'fi',
      )
      const summary = sanitizeField(item.summary) ?? `${p.name}, ${p.city} — читаю и решаю, моё ли это`
      const innerMonologue = stylizeForSegment(
        p,
        sanitizeField(item.innerMonologue) ?? '',
        p.id + 'mono',
      )

      return {
        portraitId: p.id,
        segmentLabel: p.segmentLabel,
        name: p.name,
        age: p.age,
        engagementScore: engagement,
        trustScore: trust,
        relevanceScore: relevance,
        overallScore: overall,
        sentiment,
        emotion: item.emotion ?? (sentiment === 'positive' ? 'интерес' : sentiment === 'negative' ? 'скепсис' : 'сдержанность'),
        wants,
        firstImpression,
        readingContext,
        hookedBy: item.hookedBy ?? null,
        turnedOffBy: item.turnedOffBy ?? null,
        summary,
        innerMonologue,
        wouldShare: Boolean(item.wouldShare),
        wouldComment: Boolean(item.wouldComment),
        wouldScrollPast: Boolean(item.wouldScrollPast),
        missingForMe: filterLivedPhrases(Array.isArray(item.missingForMe) ? item.missingForMe : []),
        highlights: filterLivedPhrases(Array.isArray(item.highlights) ? item.highlights : []),
      }
    })
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
  onBatchDone?: (done: number, total: number) => void,
): Promise<PersonaReaction[] | null> {
  if (!portraits.length) return []
  const merged: PersonaReaction[] = []
  const total = portraits.length

  for (let i = 0; i < portraits.length; i += OLLAMA_BATCH_SIZE) {
    const batch = portraits.slice(i, i + OLLAMA_BATCH_SIZE)
    const batchResult = await analyzePortraitBatch(text, batch, contentType, zones, imageContext)
    if (!batchResult) return null
    merged.push(...batchResult)
    onBatchDone?.(merged.length, total)
  }

  return merged
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
}

function sanitizeField(text: unknown): string | null {
  if (typeof text !== 'string' || !text.trim()) return null
  return isEditorVoice(text) ? null : text.trim()
}