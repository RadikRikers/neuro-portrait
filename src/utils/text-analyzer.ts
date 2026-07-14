import type {
  AudienceSegment,
  AudienceSegmentId,
  ContentType,
  ImageAnalysis,
  NeuroPortrait,
  PersonaReaction,
  TextGap,
  TextTestResult,
  UdmurtiaZone,
} from '../types'
import { UDMURTIA_ZONES, ZONE_KEYWORDS } from '../data/segments'
import { getSegmentById, isCustomSegmentId } from './segment-registry'

const LOCAL_MARKERS = [
  'удмурт', 'ижевск', 'сарапул', 'воткинск', 'глазов', 'можга', 'селты',
  'вожкы', 'пельме', 'бёрдо', 'бердо', 'кама', 'чепца', 'вотсин', 'горон',
  'ижгту', 'удгу', 'калашников', 'ижмаш',
]

const FEDERAL_MARKERS = [
  'москв', 'столиц', 'федеральн', 'россия объедин', 'вся страна',
  'по всей россии', 'единая россия', 'из центра',
]

const CTA_PATTERNS = [
  'напишите', 'подписывайтесь', 'жмите', 'переходите', 'узнайте',
  'регистрируйтесь', 'приходите', 'звоните', 'оставьте', 'комментир',
  'поделитесь', 'голосуйте', 'участвуйте',
]

const QUESTION_PATTERN = /\?/

interface HeuristicContext {
  text: string
  lower: string
  words: number
  paragraphs: number
  hasQuestion: boolean
  hasCta: boolean
  localHits: string[]
  federalHits: string[]
  contentType: ContentType
  zones: UdmurtiaZone[]
  mentionedZones: UdmurtiaZone[]
  isRepublicWide: boolean
}

function getMentionedZones(lower: string, zones: UdmurtiaZone[]): UdmurtiaZone[] {
  return zones.filter((z) => ZONE_KEYWORDS[z].some((kw) => lower.includes(kw)))
}

function analyzeTextSurface(text: string, contentType: ContentType, zones: UdmurtiaZone[]): HeuristicContext {
  const lower = text.toLowerCase()
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim()).length || 1
  const effectiveZones = zones.length ? zones : (['izhevsk'] as UdmurtiaZone[])

  return {
    text,
    lower,
    words,
    paragraphs,
    hasQuestion: QUESTION_PATTERN.test(text),
    hasCta: CTA_PATTERNS.some((p) => lower.includes(p)),
    localHits: LOCAL_MARKERS.filter((m) => lower.includes(m)),
    federalHits: FEDERAL_MARKERS.filter((m) => lower.includes(m)),
    contentType,
    zones: effectiveZones,
    mentionedZones: getMentionedZones(lower, effectiveZones),
    isRepublicWide: lower.includes('удмурти') || lower.includes('республик') || lower.includes('по всей'),
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function parseAgeMid(ageRange: string): number {
  const nums = ageRange.match(/\d+/g)?.map(Number) ?? [30]
  if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2)
  return nums[0] ?? 30
}

function scoreForCustomSegment(ctx: HeuristicContext, segment: AudienceSegment) {
  let engagement = 50
  let trust = 48
  let relevance = 45
  const missing: string[] = []
  const highlights: string[] = []

  if (ctx.localHits.length) {
    relevance += 12
    highlights.push(`Локальный контекст: ${ctx.localHits[0]}`)
  } else {
    missing.push(`Для «${segment.label}» нет привязки к Удмуртии`)
    relevance -= 12
  }

  for (const pain of segment.painPoints) {
    if (ctx.lower.includes(pain.toLowerCase().slice(0, 12))) {
      highlights.push(`Учтена боль: ${pain}`)
      trust += 5
    }
  }

  for (const rej of segment.rejectionTriggers) {
    if (ctx.lower.includes(rej.toLowerCase().slice(0, 10))) {
      missing.push(`Триггер отторжения: ${rej}`)
      engagement -= 8
    }
  }

  if (!ctx.hasCta) missing.push(segment.engagementTriggers[0] ? `Нет ${segment.engagementTriggers[0].toLowerCase()}` : 'Нет призыва к действию')
  if (ctx.hasQuestion) engagement += 8

  const midAge = parseAgeMid(segment.ageRange)
  const idealMax = midAge < 25 ? 180 : midAge > 50 ? 140 : 200
  if (ctx.words > idealMax) {
    missing.push('Текст слишком длинный для этого сегмента')
    engagement -= 10
  }

  return finalizeScores(engagement, trust, relevance, missing, highlights, ctx, segment.label)
}

function finalizeScores(
  engagement: number,
  trust: number,
  relevance: number,
  missing: string[],
  highlights: string[],
  ctx: HeuristicContext,
  label: string,
) {
  engagement = clamp(engagement)
  trust = clamp(trust)
  relevance = clamp(relevance)
  const overall = clamp(engagement * 0.4 + trust * 0.3 + relevance * 0.3)
  const sentiment: PersonaReaction['sentiment'] =
    overall >= 65 ? 'positive' : overall >= 45 ? 'neutral' : 'negative'

  return {
    engagement,
    trust,
    relevance,
    missing,
    highlights,
    sentiment,
    summary:
      sentiment === 'positive'
        ? `Текст скорее зацепит (${overall}%): ${label} видит себя в контенте.`
        : sentiment === 'neutral'
          ? `Скорее прочитаю без эмоций (${overall}%): не хватает точности под сегмент.`
          : `Скорее пролистаю (${overall}%): текст чужой для ${label}.`,
    innerMonologue: buildInnerMonologue(label, missing, highlights, overall),
    wouldScrollPast: overall < 40,
    wouldComment: ctx.hasQuestion && overall >= 50,
    wouldShare: overall >= 70 && ctx.localHits.length > 0,
  }
}

function scoreForSegment(
  ctx: HeuristicContext,
  segmentId: AudienceSegmentId,
  customSegments: AudienceSegment[],
): {
  engagement: number
  trust: number
  relevance: number
  missing: string[]
  highlights: string[]
  sentiment: PersonaReaction['sentiment']
  summary: string
  innerMonologue: string
  wouldShare: boolean
  wouldComment: boolean
  wouldScrollPast: boolean
} {
  const segment = getSegmentById(segmentId, customSegments)
  if (isCustomSegmentId(segmentId)) return scoreForCustomSegment(ctx, segment)

  let engagement = 55
  let trust = 50
  let relevance = 45
  const missing: string[] = []
  const highlights: string[] = []

  if (ctx.localHits.length > 0) {
    relevance += 15
    highlights.push(`Узнаю свой регион: ${ctx.localHits.slice(0, 3).join(', ')}`)
  } else {
    missing.push('Нет локальных маркеров Удмуртии (город, место, культура)')
    relevance -= 15
  }

  if (ctx.federalHits.length > 0) {
    trust -= 12
    relevance -= 10
    missing.push('Ощущается федеральный/московский шаблон')
  }

  if (ctx.hasQuestion) {
    engagement += 10
    highlights.push('Есть вопрос — хочется ответить')
  } else if (['school', 'student', 'parent', 'kindergarten_parent'].includes(segmentId)) {
    missing.push('Нет вопроса или приглашения к диалогу')
    engagement -= 8
  }

  if (ctx.hasCta) {
    engagement += 8
    trust += 5
  } else {
    missing.push('Нет понятного призыва к действию')
    engagement -= 5
  }

  const lengthRules: Record<AudienceSegmentId, { ideal: [number, number]; penalty: string }> = {
    school: { ideal: [30, 120], penalty: 'Для школьников текст слишком длинный или слишком короткий' },
    student: { ideal: [50, 200], penalty: 'Студентам нужен текст средней длины с конкретикой' },
    young_pro: { ideal: [60, 250], penalty: 'Молодым специалистам нужна структура и факты' },
    worker: { ideal: [40, 150], penalty: 'Рабочему классу нужен короткий текст по делу' },
    parent: { ideal: [50, 180], penalty: 'Родителям нужна ясная польза без воды' },
    kindergarten_parent: { ideal: [40, 160], penalty: 'Родителям детсадов нужен короткий тёплый текст' },
    senior: { ideal: [40, 140], penalty: 'Пенсионерам нужны короткие абзацы и ясность' },
    rural: { ideal: [40, 160], penalty: 'Сельским жителям нужен простой понятный текст' },
    udmurt_speaker: { ideal: [50, 200], penalty: 'Нужен баланс: русский + удмуртский контекст' },
  }

  const rule = lengthRules[segmentId]
  if (ctx.words < rule.ideal[0] || ctx.words > rule.ideal[1]) {
    missing.push(rule.penalty)
    engagement -= ctx.words > rule.ideal[1] ? 12 : 6
  }

  if (segmentId === 'udmurt_speaker') {
    const udmurtWords = ['вожкы', 'удмурт', 'бёрдо', 'бердо', 'пельме', 'вотсин', 'горон']
    if (udmurtWords.some((w) => ctx.lower.includes(w))) {
      relevance += 20
      trust += 15
      highlights.push('Есть удмуртский культурный код')
    } else {
      missing.push('Нет удмуртского языка или культурных маркеров')
      relevance -= 20
    }
  }

  if (segmentId === 'rural' && !ctx.lower.includes('сел') && !ctx.lower.includes('дерев') && !ctx.zones.includes('rural')) {
    missing.push('Сельская аудитория не видит себя — только городской контекст')
    relevance -= 12
  }

  if (segmentId === 'kindergarten_parent') {
    const daycare = ['детсад', 'дошкольн', 'малыш', 'адаптац', 'садик', 'ясли']
    if (daycare.some((w) => ctx.lower.includes(w))) {
      highlights.push('Учтена тема дошкольного возраста')
      relevance += 12
    } else {
      missing.push('Нет темы детсада/дошкольников — родители малышей не узнают себя')
      relevance -= 10
    }
    if (ctx.zones.length > 1 && ctx.mentionedZones.length === 1 && !ctx.isRepublicWide) {
      missing.push('Пост на несколько городов, но назван только один — родители из других зон отстроятся')
      relevance -= 8
    }
  }

  if (ctx.zones.length > 1) {
    if (ctx.isRepublicWide) {
      highlights.push('Республиканский охват — подходит для поста на всю Удмуртию')
      relevance += 8
    } else if (ctx.mentionedZones.length === 0) {
      missing.push(`Не назван ни один из выбранных городов: ${ctx.zones.map((z) => UDMURTIA_ZONES.find((u) => u.id === z)?.name).join(', ')}`)
      relevance -= 10
    } else if (ctx.mentionedZones.length < ctx.zones.length && ctx.mentionedZones.length === 1) {
      missing.push('Упомянут один город, а тестируете несколько — добавьте «Удмуртия» или перечислите города')
      relevance -= 6
    } else if (ctx.mentionedZones.length >= 2) {
      highlights.push('Упомянуто несколько городов республики')
      relevance += 10
    }
  }

  if (['school', 'student'].includes(segmentId)) {
    const slang = ['кринж', 'имба', 'рофл', 'чел', 'норм']
    const official = ['в рамках', 'осуществля', 'данный', 'является', 'настоящим']
    if (official.some((w) => ctx.lower.includes(w))) {
      missing.push('Слишком официальный язык для молодёжи')
      engagement -= 15
      trust -= 8
    }
    if (slang.some((w) => ctx.lower.includes(w))) {
      highlights.push('Язык ближе к молодёжи')
      engagement += 8
    }
  }

  if (segmentId === 'senior') {
    const slang = ['кринж', 'имба', 'рофл', 'чел', 'лол', 'тг', 'вк']
    if (slang.some((w) => ctx.lower.includes(w))) {
      missing.push('Молодёжный сленг отталкивает старшую аудиторию')
      trust -= 15
      engagement -= 10
    }
    if (ctx.paragraphs >= 2 && ctx.words / ctx.paragraphs < 80) {
      highlights.push('Текст разбит на понятные части')
      trust += 8
    }
  }

  if (segmentId === 'worker' || segmentId === 'parent' || segmentId === 'kindergarten_parent') {
    const abstract = ['синергия', 'трансформация', 'инновационный вектор', 'стратегический потенциал']
    if (abstract.some((w) => ctx.lower.includes(w))) {
      missing.push('Слишком абстрактно — непонятна практическая польза')
      trust -= 12
    }
  }

  if (ctx.contentType === 'stories' && ctx.words > 100) {
    missing.push('Для Stories текст слишком длинный')
    engagement -= 10
  }

  return finalizeScores(engagement, trust, relevance, missing, highlights, ctx, segment.label)
}

function buildInnerMonologue(
  label: string,
  missing: string[],
  highlights: string[],
  score: number,
): string {
  const parts: string[] = [`Я — ${label}.`]
  if (highlights.length) parts.push(`Цепляет: ${highlights[0]}.`)
  if (missing.length) parts.push(`Не хватает: ${missing[0]}.`)
  if (score < 45) parts.push('Чувствую, что это написано «для отчёта», не для меня.')
  else if (score >= 70) parts.push('Могу сохранить или переслать знакомым.')
  return parts.join(' ')
}

function detectGaps(ctx: HeuristicContext, reactions: PersonaReaction[]): TextGap[] {
  const gaps: TextGap[] = []
  const missingCounts = new Map<string, number>()

  for (const r of reactions) {
    for (const m of r.missingForMe) {
      missingCounts.set(m, (missingCounts.get(m) ?? 0) + 1)
    }
  }

  if (ctx.localHits.length === 0 && !ctx.isRepublicWide) {
    gaps.push({
      id: 'local',
      severity: 'high',
      category: 'Локальный контекст',
      title: 'Нет привязки к Удмуртии',
      description: 'Текст мог бы быть из любого региона.',
      suggestion: 'Добавьте город, место, местный контекст: Ижевск, Кама, «Подслушано», пельме, вожкы.',
    })
  }

  if (ctx.zones.length > 1 && !ctx.isRepublicWide && ctx.mentionedZones.length < Math.min(2, ctx.zones.length)) {
    const names = ctx.zones.map((z) => UDMURTIA_ZONES.find((u) => u.id === z)?.name).filter(Boolean).join(', ')
    gaps.push({
      id: 'multi-city',
      severity: ctx.mentionedZones.length === 0 ? 'high' : 'medium',
      category: 'Несколько городов',
      title: 'Пост на всю Удмуртию, но не все города учтены',
      description: `Выбраны: ${names}. В тексте: ${ctx.mentionedZones.length ? ctx.mentionedZones.map((z) => UDMURTIA_ZONES.find((u) => u.id === z)?.name).join(', ') : 'ни одного'}.`,
      suggestion: 'Добавьте «жители Удмуртии» / «во всех городах республики» или перечислите выбранные города.',
    })
  }

  if (ctx.federalHits.length > 0) {
    gaps.push({
      id: 'federal',
      severity: 'high',
      category: 'Федеральный след',
      title: 'Шаблон из центра',
      description: `Найдены маркеры: ${ctx.federalHits.join(', ')}`,
      suggestion: 'Замените федеральные формулировки на удмуртские реалии и конкретику.',
    })
  }

  if (!ctx.hasCta) {
    gaps.push({
      id: 'cta',
      severity: 'medium',
      category: 'Вовлечение',
      title: 'Нет призыва к действию',
      description: 'Аудитория не понимает, что делать дальше.',
      suggestion: 'Добавьте вопрос, опрос, ссылку или приглашение написать в комментариях.',
    })
  }

  for (const [msg, count] of missingCounts) {
    if (count >= 2) {
      gaps.push({
        id: `agg-${msg.slice(0, 20)}`,
        severity: count >= reactions.length / 2 ? 'high' : 'medium',
        category: 'Аудитория',
        title: msg,
        description: `Отмечено ${count} из ${reactions.length} персонажей.`,
        suggestion: `Переработайте текст с учётом: ${msg}`,
      })
    }
  }

  return gaps.slice(0, 8)
}

function buildRecommendations(gaps: TextGap[], ctx: HeuristicContext, images: ImageAnalysis[]): string[] {
  const recs = gaps.map((g) => g.suggestion)
  if (ctx.words > 200) recs.push('Сократите текст: принцип «один абзац — одна мысль».')
  if (!ctx.hasQuestion) recs.push('Добавьте вопрос в конце — это поднимает комментарии.')
  if (ctx.localHits.length < 2) recs.push('Усильте локальность: 2–3 конкретных маркера Удмуртии.')
  for (const img of images) {
    for (const w of img.warnings) recs.push(`Визуал (${img.fileName}): ${w}`)
  }
  return [...new Set(recs)].slice(0, 8)
}

function imageGaps(images: ImageAnalysis[]): TextGap[] {
  return images.flatMap((img, i) => [
    ...img.warnings.map((w, j) => ({
      id: `img-warn-${i}-${j}`,
      severity: 'medium' as const,
      category: 'Визуал',
      title: w,
      description: `Файл: ${img.fileName}`,
      suggestion: 'Скорректируйте изображение или подпишите текстом локальный контекст',
    })),
    ...(img.textImageSync.includes('картинка локальная')
      ? [{
          id: `img-sync-${i}`,
          severity: 'high' as const,
          category: 'Текст + визуал',
          title: 'Рассинхрон текста и картинки',
          description: img.textImageSync,
          suggestion: 'Добавьте в текст те же локальные маркеры, что на изображении',
        }]
      : []),
  ])
}

function applyImageBoost(reactions: PersonaReaction[], images: ImageAnalysis[]): PersonaReaction[] {
  if (!images.length) return reactions
  const avgFit = images.reduce((s, i) => s + i.udmurtiaFitScore, 0) / images.length
  const boost = Math.round((avgFit - 50) / 5)

  return reactions.map((r) => {
    const engagement = clamp(r.engagementScore + boost)
    const relevance = clamp(r.relevanceScore + Math.round(boost * 1.2))
    const overall = clamp(engagement * 0.4 + r.trustScore * 0.3 + relevance * 0.3)
    const highlights = [...r.highlights]
    if (avgFit >= 60) highlights.push('Визуал усиливает локальный контекст')
    return { ...r, engagementScore: engagement, relevanceScore: relevance, overallScore: overall, highlights }
  })
}

export function analyzeTextHeuristic(
  text: string,
  portraits: NeuroPortrait[],
  contentType: ContentType,
  zones: UdmurtiaZone[],
  customSegments: AudienceSegment[] = [],
  imageAnalyses: ImageAnalysis[] = [],
): TextTestResult {
  const ctx = analyzeTextSurface(text, contentType, zones)

  let reactions: PersonaReaction[] = portraits.map((p) => {
    const s = scoreForSegment(ctx, p.segmentId, customSegments)
    const overall = clamp(s.engagement * 0.4 + s.trust * 0.3 + s.relevance * 0.3)
    return {
      portraitId: p.id,
      segmentLabel: p.segmentLabel,
      name: p.name,
      age: p.age,
      engagementScore: s.engagement,
      trustScore: s.trust,
      relevanceScore: s.relevance,
      overallScore: overall,
      sentiment: s.sentiment,
      summary: s.summary,
      innerMonologue: s.innerMonologue,
      wouldShare: s.wouldShare,
      wouldComment: s.wouldComment,
      wouldScrollPast: s.wouldScrollPast,
      missingForMe: s.missing,
      highlights: s.highlights,
    }
  })

  reactions = applyImageBoost(reactions, imageAnalyses)
  const gaps = [...detectGaps(ctx, reactions), ...imageGaps(imageAnalyses)].slice(0, 10)
  const avg = (key: keyof Pick<PersonaReaction, 'engagementScore' | 'trustScore' | 'relevanceScore' | 'overallScore'>) =>
    clamp(reactions.reduce((sum, r) => sum + r[key], 0) / reactions.length)

  const federalTraceRisk: TextTestResult['federalTraceRisk'] =
    ctx.federalHits.length >= 2 || (ctx.localHits.length === 0 && ctx.federalHits.length > 0)
      ? 'high'
      : ctx.federalHits.length > 0 || ctx.localHits.length === 0
        ? 'medium'
        : 'low'

  return {
    text,
    contentType,
    zones: ctx.zones,
    testedAt: new Date().toISOString(),
    aggregateEngagement: avg('engagementScore'),
    aggregateRelevance: avg('relevanceScore'),
    aggregateTrust: avg('trustScore'),
    overallScore: avg('overallScore'),
    federalTraceRisk,
    federalTraceNote:
      federalTraceRisk === 'high'
        ? 'Текст звучит как федеральный шаблон — удмуртская аудитория может отвергнуть.'
        : federalTraceRisk === 'medium'
          ? 'Есть признаки «чужого» контента — усильте локальный контекст.'
          : 'Федеральный след минимален — хорошая база для доработки.',
    reactions,
    gaps,
    recommendations: buildRecommendations(gaps, ctx, imageAnalyses),
    imageAnalyses,
    source: 'heuristic',
  }
}