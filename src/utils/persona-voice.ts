import type { AudienceSegmentId, ContentType, NeuroPortrait, PresetSegmentId } from '../types'

interface HeuristicCtx {
  lower: string
  hasQuestion: boolean
  hasCta: boolean
  localHits: string[]
  federalHits: string[]
  words: number
  paragraphs: number
  contentType: ContentType
}

export interface PersonaNarrative {
  emotion: string
  wants: string
  firstImpression: string
  summary: string
  innerMonologue: string
}

const EMOTIONS = {
  positive: ['интерес', 'радость', 'гордость', 'любопытство', 'воодушевление', 'доверие'],
  neutral: ['сдержанность', 'настороженность', 'равнодушие', 'скепсис', 'задумчивость'],
  negative: ['раздражение', 'недоверие', 'скука', 'тревога', 'отторжение', 'усталость'],
} as const

const SEGMENT_WANTS: Record<PresetSegmentId, string[]> = {
  school: [
    'понять, есть ли что-то для моего возраста, а не «для всех»',
    'увидеть живой тон, а не нотацию от взрослых',
    'получить повод скинуть друзьям или поучаствовать',
  ],
  student: [
    'увидеть реальную пользу — стажировка, событие, возможность',
    'чтобы не стыдно было репостнуть — без пафоса и штампов',
    'понять, зачем мне это сейчас, а не «когда-нибудь»',
  ],
  young_pro: [
    'конкретику: даты, места, цифры, что делать дальше',
    'ощущение, что регион развивается, а не «отчитывается»',
    'короткий понятный вывод без воды',
  ],
  worker: [
    'понять практическую пользу для семьи и работы',
    'увидеть уважение к труду, а не красивые слова',
    'чтобы не тратили время — суть в двух фразах',
  ],
  parent: [
    'ясную пользу для ребёнка и семьи',
    'безопасность и понятные шаги «что делать»',
    'тёплый тон без запугивания и официоза',
  ],
  kindergarten_parent: [
    'уверенность, что ребёнку будет хорошо и безопасно',
    'советы по адаптации или поддержке родителей',
    'чтобы не только про один город, если пост на всю республику',
  ],
  senior: [
    'ясность без мелкого шрифта и сложных слов',
    'уважительный тон и связь с традициями региона',
    'понять, куда обратиться или что получить',
  ],
  rural: [
    'увидеть сельскую жизнь, а не только Ижевск',
    'понять, как это касается села и семьи',
    'простые слова про дороги, ярмарки, клуб, быт',
  ],
  udmurt_speaker: [
    'живой удмуртский контекст, а не «галочка для отчёта»',
    'уважение к языку и культуре без стереотипов',
    'ощущение, что нас слышат, а не используют для картинки',
  ],
}

const SEGMENT_IMPRESSIONS: Record<PresetSegmentId, { good: string[]; mid: string[]; bad: string[] }> = {
  school: {
    good: ['О, про нас что-то нормальное, не как в школе на линейке.', 'Звучит живо — можно глянуть.'],
    mid: ['Ну такое… вроде не бесит, но и не цепляет.', 'Прочитаю, если друзья скинут.'],
    bad: ['Опять взрослые пишут «для молодёжи» — кринж.', 'Пролистаю, это не про меня.'],
  },
  student: {
    good: ['Наконец что-то по делу, не «развитие потенциала».', 'Можно сходить / репостнуть в чат.'],
    mid: ['Идея норм, но подано как пресс-релиз.', 'Посмотрю, если будет время.'],
    bad: ['Московский шаблон в ижевской обёртке.', 'Снова пустые слова — зря время.'],
  },
  young_pro: {
    good: ['Структурно и по делу — сохраню.', 'Видно локальный контекст, не федеральный шаблон.'],
    mid: ['Тема интересная, но мало конкретики.', 'Дочитаю, если в конце будет CTA.'],
    bad: ['Вода и абстракции — для отчёта, не для людей.', 'Не вижу, зачем мне это.'],
  },
  worker: {
    good: ['По-человечески, без заумности — уважают.', 'Понятно, что делать и кому это нужно.'],
    mid: ['Вроде не врут, но толку мало пока.', 'Прочитаю до конца, если коротко.'],
    bad: ['Опять красивые слова — людей не слышат.', 'Чужой текст, не про нашу жизнь.'],
  },
  parent: {
    good: ['Спокойно и по делу — подумаю, полезно ли детям.', 'Тёплый тон, чувствую заботу.'],
    mid: ['Непонятно, как это поможет семье.', 'Нужно больше конкретики про детей.'],
    bad: ['Пугают или давят — не доверяю.', 'Опять общие слова без пользы.'],
  },
  kindergarten_parent: {
    good: ['Про малышей и семью — читаю внимательно.', 'Спокойно, без паники — можно дочитать.'],
    mid: ['Тема вроде наша, но мало про детсад.', 'Хочется больше про безопасность и адаптацию.'],
    bad: ['Не про дошкольников — мы тут ни при чём.', 'Тревожно и непонятно — пролистаю.'],
  },
  senior: {
    good: ['Ясно написано, уважительно — дочитаю.', 'Приятно, что помнят про регион.'],
    mid: ['Много слов, суть не сразу видна.', 'Прочитаю, если коротко и по пунктам.'],
    bad: ['Непонятные слова и сленг — отстаньте.', 'Чувствую, что пишут не для нас.'],
  },
  rural: {
    good: ['Про деревню и землю — это наше.', 'Наконец не только про столицу республики.'],
    mid: ['Вроде про Удмуртию, но городской уклон.', 'Мало про сельскую жизнь.'],
    bad: ['Снова только Ижевск — мы не существуем.', 'Чужой городской PR.'],
  },
  udmurt_speaker: {
    good: ['Слышу наш культурный код — откликается.', 'Уважение к языку чувствуется.'],
    mid: ['Тема правильная, но без живого удмуртского.', 'Формально про культуру, без души.'],
    bad: ['Стереотипы и «галочка» — обидно.', 'Только русский шаблон — не про нас.'],
  },
}

function hashJitter(seed: string, min: number, max: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const span = max - min + 1
  return min + (Math.abs(h) % span)
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hashJitter(seed, 0, arr.length - 1)]
}

function isPreset(id: AudienceSegmentId): id is PresetSegmentId {
  return id in SEGMENT_WANTS
}

function cityMentioned(portrait: NeuroPortrait, lower: string): boolean {
  return lower.includes(portrait.city.toLowerCase())
}

export function portraitScoreBias(portrait: NeuroPortrait, ctx: HeuristicCtx): {
  engagement: number
  trust: number
  relevance: number
} {
  let engagement = 0
  let trust = 0
  let relevance = 0
  const seed = portrait.id

  engagement += hashJitter(seed + 'e', -8, 8)
  trust += hashJitter(seed + 't', -6, 6)
  relevance += hashJitter(seed + 'r', -7, 7)

  if (cityMentioned(portrait, ctx.lower)) {
    relevance += 14
    trust += 6
  }

  if (ctx.lower.includes(portrait.favoritePlace.toLowerCase().slice(0, 8))) {
    relevance += 8
  }

  const occ = portrait.occupation.toLowerCase()
  if (occ.split(/\s+/).some((w) => w.length > 4 && ctx.lower.includes(w.slice(0, 5)))) {
    relevance += 5
  }

  if (portrait.age < 20 && ctx.words > 150) engagement -= 6
  if (portrait.age > 55 && ctx.words > 120) trust -= 5
  if (portrait.age > 55 && ctx.paragraphs >= 2) trust += 4

  return { engagement, trust, relevance }
}

function emotionFor(
  sentiment: 'positive' | 'neutral' | 'negative',
  portrait: NeuroPortrait,
  ctx: HeuristicCtx,
): string {
  const pool = EMOTIONS[sentiment]
  let emotion = pick([...pool], portrait.id)

  if (ctx.federalHits.length > 0 && portrait.segmentId !== 'young_pro') {
    emotion = sentiment === 'negative' ? 'недоверие' : 'настороженность'
  }
  if (cityMentioned(portrait, ctx.lower) && sentiment === 'positive') {
    emotion = pick(['гордость', 'интерес', 'радость'], portrait.name)
  }
  if (portrait.segmentId === 'kindergarten_parent' && sentiment === 'negative') {
    emotion = pick(['тревога', 'настороженность'], portrait.id)
  }

  return emotion
}

export function buildPersonaNarrative(
  portrait: NeuroPortrait,
  sentiment: 'positive' | 'neutral' | 'negative',
  overall: number,
  missing: string[],
  highlights: string[],
  ctx: HeuristicCtx,
): PersonaNarrative {
  const emotion = emotionFor(sentiment, portrait, ctx)
  const preset = isPreset(portrait.segmentId) ? portrait.segmentId : null

  const wants = preset
    ? pick(SEGMENT_WANTS[preset], portrait.id + 'w')
    : `понять, зачем это «${portrait.segmentLabel}» из ${portrait.city}`

  const impressions = preset ? SEGMENT_IMPRESSIONS[preset] : {
    good: ['Вроде про нас.', 'Можно дочитать.'],
    mid: ['Непонятно, моё ли это.', 'Середнячок.'],
    bad: ['Не про меня.', 'Пролистаю.'],
  }

  const firstImpression =
    sentiment === 'positive'
      ? pick(impressions.good, portrait.id + 'g')
      : sentiment === 'neutral'
        ? pick(impressions.mid, portrait.id + 'm')
        : pick(impressions.bad, portrait.id + 'b')

  const summary = buildSummary(portrait, sentiment, overall, emotion, firstImpression)
  const innerMonologue = buildInnerMonologue(portrait, emotion, wants, missing, highlights, overall, ctx)

  return { emotion, wants, firstImpression, summary, innerMonologue }
}

function buildSummary(
  portrait: NeuroPortrait,
  sentiment: 'positive' | 'neutral' | 'negative',
  overall: number,
  emotion: string,
  firstImpression: string,
): string {
  const who = `${portrait.name}, ${portrait.age} лет, ${portrait.city}`
  if (sentiment === 'positive') {
    return `${who} — ${emotion} (${overall}%): ${firstImpression}`
  }
  if (sentiment === 'neutral') {
    return `${who} — ${emotion}, сомневается (${overall}%): ${firstImpression}`
  }
  return `${who} — ${emotion}, отстраивается (${overall}%): ${firstImpression}`
}

function buildInnerMonologue(
  portrait: NeuroPortrait,
  emotion: string,
  wants: string,
  missing: string[],
  highlights: string[],
  score: number,
  ctx: HeuristicCtx,
): string {
  const parts: string[] = []

  parts.push(`Я ${portrait.name}, ${portrait.occupation.toLowerCase()}, живу в ${portrait.city}.`)

  parts.push(`Первое впечатление — ${emotion}.`)

  if (highlights.length) {
    parts.push(highlights[0].endsWith('.') ? highlights[0] : `${highlights[0]}.`)
  }

  if (missing.length) {
    parts.push(`Но мне не хватает: ${missing[0].toLowerCase()}.`)
  }

  parts.push(`Хочу от этого поста: ${wants.charAt(0).toLowerCase()}${wants.slice(1)}.`)

  if (score < 40) {
    parts.push('Скорее пролистаю — чувствую, что пишут не для таких, как я.')
  } else if (score >= 70 && ctx.hasQuestion) {
    parts.push('Могу ответить в комментариях, если вопрос по делу.')
  } else if (score >= 70) {
    parts.push('Могу сохранить или переслать тем, кому актуально.')
  }

  return parts.join(' ')
}