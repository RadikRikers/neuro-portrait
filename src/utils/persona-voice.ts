import {
  getVoiceProfile,
  isPresetSegment,
  VOICE_REACTION_TEMPLATES,
  type UdmurtiaVoiceProfile,
} from '../data/udmurtia-voices'
import type { AudienceSegmentId, ContentType, NeuroPortrait, PresetSegmentId } from '../types'

export interface HeuristicCtx {
  text: string
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
  readingContext: string
  hookedBy: string | null
  turnedOffBy: string | null
  summary: string
  innerMonologue: string
  livedHighlights: string[]
  livedMissing: string[]
}

const EMOTIONS = {
  positive: ['интерес', 'радость', 'гордость', 'любопытство', 'воодушевление', 'доверие'],
  neutral: ['сдержанность', 'настороженность', 'равнодушие', 'скепсис', 'задумчивость'],
  negative: ['раздражение', 'недоверие', 'скука', 'тревога', 'отторжение', 'усталость'],
} as const

const OFFICIAL_MARKERS = [
  'в рамках', 'осуществля', 'данный', 'является', 'настоящим', 'инновац',
  'трансформац', 'потенциал', 'синерг', 'федеральн', 'масштабн',
]

/** Фразы редактора/маркетолога — не должны попадать в отклик жителя */
const EDITOR_VOICE = [
  /нет (cta|призыва|локальн|вопроса|понятного)/i,
  /добавьте/i,
  /нужн[ао] (локальн|структур|баланс)/i,
  /текст слишком/i,
  /инфопост/i,
  /для (школьник|студент|родител|пенсионер|рабоч)/i,
  /локальн(ый|ых) маркер/i,
  /триггер/i,
  /привязк[аи] к удмуртии/i,
  /призыв к действию/i,
  /не раскрыта суть/i,
  /учтена (боль|тема)/i,
  /сработал триггер/i,
  /понятный информационный/i,
  /редактор/i,
  /реценз/i,
]

export function isEditorVoice(phrase: string): boolean {
  return EDITOR_VOICE.some((re) => re.test(phrase))
}

export function filterLivedPhrases(phrases: string[]): string[] {
  return phrases.filter((p) => p.trim() && !isEditorVoice(p))
}

const SEGMENT_SELF: Partial<Record<PresetSegmentId, { keywords: string[]; hit: string; miss: string }>> = {
  school: {
    keywords: ['школ', 'урок', 'экзамен', 'огэ', 'егэ', 'класс', 'учител', 'директ'],
    hit: 'ну типа про школу — жиза, это моё',
    miss: 'школа не звучит — мимо, пролистну',
  },
  student: {
    keywords: ['универ', 'студент', 'сессия', 'общаг', 'пара', 'диплом', 'ижгту', 'удгу'],
    hit: 'короче про универ/сессию — зашло, не душно',
    miss: 'ни слова про учёбу — ну такое, мимо',
  },
  young_pro: {
    keywords: ['карьер', 'зарплат', 'работ', 'професс', 'специалист', 'ваканс', 'проект'],
    hit: 'по сути про работу и рост — мне актуально',
    miss: 'не вижу зачем мне как специалисту — вода',
  },
  worker: {
    keywords: ['смен', 'завод', 'цех', 'зарплат', 'рабоч', 'производств', 'калашников', 'ижмаш'],
    hit: 'вот про смену и завод — своим перешлю',
    miss: 'опять не про тех кто на смене — не моё',
  },
  parent: {
    keywords: ['ребён', 'дет', 'школ', 'кружок', 'секци', 'родител', 'урок'],
    hit: 'ну вот про детей — сохраню в чат',
    miss: 'не про родительские заботы — пройду мимо',
  },
  senior: {
    keywords: ['пенси', 'здоров', 'поликлин', 'врач', 'внук', 'льгот', 'памят'],
    hit: 'вот про льготы/здоровье — понятно написано',
    miss: 'молодёжное или чужое — не про меня, закрою',
  },
  svo_participant: {
    keywords: ['сво', 'фронт', 'контракт', 'льгот', 'семьи бойцов', 'ветеран'],
    hit: 'короче про семьи и поддержку — по делу',
    miss: 'пафос без конкретики — мимо',
  },
  svo_veteran: {
    keywords: ['реабилитац', 'ветеран', 'выплат', 'поликлин', 'птср', 'сво'],
    hit: 'вот про реабилитацию и права — дочитаю',
    miss: 'показная благодарность без дела — бесит',
  },
  svo_family_spouse: {
    keywords: ['семьи', 'выплат', 'посылк', 'детей', 'сво', 'поддержк'],
    hit: 'ну вот про семьи участников — сохраню',
    miss: 'пустые слова поддержки — злюсь',
  },
  svo_family_parent: {
    keywords: ['сын', 'дочь', 'семьи бойцов', 'льгот', 'юридическ', 'сво'],
    hit: 'вот про родителей и помощь — понятно',
    miss: 'политический пафос — не то',
  },
  opposition: {
    keywords: ['расследован', 'факт', 'данн', 'проблем', 'коррупц', 'обман'],
    hit: 'если честно есть факты — дочитаю',
    miss: 'пропаганда и лозунги — мимо',
  },
  patriot_loyalist: {
    keywords: ['память', 'победа', 'герой', 'сво', 'ветеран', 'подвиг'],
    hit: 'правильно про память и армию — перешлю',
    miss: 'нейтралитет — раздражает',
  },
  entrepreneur: {
    keywords: ['ип', 'бизнес', 'грант', 'налог', 'поддержк предприним', 'аренд'],
    hit: 'по сути про бизнес — интересно',
    miss: 'обещания без цифр — вода',
  },
  blogger: {
    keywords: ['тренд', 'контент', 'охват', 'вирус', 'мем'],
    hit: 'хук норм — можно в сторис',
    miss: 'кринжовый официоз — мимо',
  },
  teacher: {
    keywords: ['школ', 'дет', 'егэ', 'огэ', 'урок', 'педагог'],
    hit: 'ну вот про школу и детей — полезно',
    miss: 'политизация — не надо',
  },
  medic: {
    keywords: ['здоров', 'поликлин', 'врач', 'лечен', 'профилакт'],
    hit: 'без паники про здоровье — ок',
    miss: 'псевдонаука — бесит',
  },
  volunteer: {
    keywords: ['волонтёр', 'сбор', 'помощь', 'нко', 'отчёт'],
    hit: 'есть конкретное дело — репост',
    miss: 'пустой призыв — показуха',
  },
  unemployed: {
    keywords: ['ваканс', 'работ', 'цзн', 'сокращен', 'обучен'],
    hit: 'вакансия или программа — сохраню',
    miss: 'мотивашка без контактов — бесит',
  },
  urban_mass: {
    keywords: ['ижевск', 'дорог', 'троллейбус', 'цен', 'жкх', 'транспорт'],
    hit: 'ну про город и быт — норм',
    miss: 'идеология и длиннота — листаю',
  },
}

function hashJitter(seed: string, min: number, max: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return min + (Math.abs(h) % (max - min + 1))
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hashJitter(seed, 0, arr.length - 1)]
}

function isPreset(id: AudienceSegmentId): id is PresetSegmentId {
  return isPresetSegment(id)
}

function fillTpl(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

function maybeFiller(profile: UdmurtiaVoiceProfile | null, seed: string): string {
  if (!profile?.fillers.length) return ''
  return hashJitter(seed, 0, 2) === 0 ? `${pick(profile.fillers, seed)} ` : ''
}

function voiceFor(portrait: NeuroPortrait): UdmurtiaVoiceProfile | null {
  return isPresetSegment(portrait.segmentId) ? getVoiceProfile(portrait.segmentId) : null
}

export function stylizeForSegment(portrait: NeuroPortrait, plain: string, seed: string): string {
  const profile = voiceFor(portrait)
  if (!profile) return plain
  const filler = maybeFiller(profile, seed)
  const lower = plain.toLowerCase()
  if (profile.slang.some((s) => lower.includes(s))) return `${filler}${plain}`
  return `${filler}${plain}`
}

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.+?[.!?…])\s/s) ?? trimmed.match(/^(.{20,90})/s)
  const s = (match?.[1] ?? trimmed).trim().replace(/\s+/g, ' ')
  return s.length > 100 ? `${s.slice(0, 97)}…` : s
}

function quoteFragment(text: string, keyword: string): string | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(keyword.toLowerCase())
  if (idx < 0) return null
  const start = Math.max(0, idx - 25)
  const end = Math.min(text.length, idx + keyword.length + 35)
  let frag = text.slice(start, end).trim().replace(/\s+/g, ' ')
  if (start > 0) frag = `…${frag}`
  if (end < text.length) frag = `${frag}…`
  return `«${frag}»`
}

function findOfficialFragment(text: string): string | null {
  for (const m of OFFICIAL_MARKERS) {
    const q = quoteFragment(text, m)
    if (q) return q
  }
  return null
}

function cityMentioned(portrait: NeuroPortrait, lower: string): boolean {
  return lower.includes(portrait.city.toLowerCase())
}

interface FormulationRead {
  hookedBy: string | null
  turnedOffBy: string | null
  selfLink: string
  livedHighlights: string[]
  livedMissing: string[]
}

function matchPortraitKeyword(portrait: NeuroPortrait, ctx: HeuristicCtx, minLen = 5): string | null {
  for (const pain of portrait.painPoints) {
    const key = pain.toLowerCase().slice(0, Math.min(14, pain.length))
    if (key.length >= minLen && ctx.lower.includes(key)) return pain
  }
  for (const val of portrait.values) {
    const key = val.toLowerCase().slice(0, Math.min(12, val.length))
    if (key.length >= minLen && ctx.lower.includes(key)) return val
  }
  const occ = portrait.occupation.toLowerCase().slice(0, 10)
  if (occ.length >= minLen && ctx.lower.includes(occ)) return portrait.occupation
  return null
}

function readFormulations(portrait: NeuroPortrait, ctx: HeuristicCtx): FormulationRead {
  const livedHighlights: string[] = []
  const livedMissing: string[] = []
  let hookedBy: string | null = null
  let turnedOffBy: string | null = null
  let selfLink = 'Пока не понимаю, при чём тут я'

  const opener = firstSentence(ctx.text)
  const personalHit = matchPortraitKeyword(portrait, ctx)
  if (personalHit) {
    const q = quoteFragment(ctx.text, personalHit) ?? `«${personalHit}»`
    hookedBy = hookedBy ?? q
    livedHighlights.push(`узнал себя — ${personalHit.toLowerCase()}, жиза`)
    selfLink = `ну типа это про то чем я живу — ${personalHit.toLowerCase()}`
  }

  if (cityMentioned(portrait, ctx.lower)) {
    const q = quoteFragment(ctx.text, portrait.city) ?? `«${portrait.city}»`
    hookedBy = q
    livedHighlights.push(`мой ${portrait.city} — норм, про мои улицы`)
    selfLink = `это про ${portrait.city} где я живу, не абстрактная республика`
  } else if (ctx.localHits.length > 0) {
    const hit = ctx.localHits.find((h) => ctx.lower.includes(h)) ?? ctx.localHits[0]
    hookedBy = quoteFragment(ctx.text, hit) ?? `«${hit}»`
    livedHighlights.push(`узнаю удмуртию в тексте — не шаблон`)
    selfLink = 'пишут про нашу удмуртию, не про любой регион'
  }

  if (portrait.segmentId === 'rural' && !ctx.lower.includes('сел') && !ctx.lower.includes('дерев') && ctx.lower.includes('ижевск')) {
    turnedOffBy = quoteFragment(ctx.text, 'ижевск') ?? '«Ижевск»'
    livedMissing.push('опять только ижевск — я в селе, далеко')
    selfLink = 'написано для ижевчан, а я в сельской удмуртии'
  }

  if (portrait.segmentId === 'udmurt_speaker') {
    const udmurt = ['вожкы', 'удмурт', 'бёрдо', 'бердо', 'пельме', 'вотсин']
    const found = udmurt.find((w) => ctx.lower.includes(w))
    if (found) {
      hookedBy = quoteFragment(ctx.text, found) ?? hookedBy
      livedHighlights.push('вожкы! слышу свой код, не галочка')
      selfLink = 'это про мою идентичность, ар уды'
    } else {
      livedMissing.push('ни слова по-нашему — чужой тон, обидно')
      selfLink = 'читаю про культуру, но себя не слышу'
    }
  }

  if (isPreset(portrait.segmentId) && SEGMENT_SELF[portrait.segmentId]) {
    const seg = SEGMENT_SELF[portrait.segmentId]!
    const found = seg.keywords.find((w) => ctx.lower.includes(w))
    if (found) {
      hookedBy = quoteFragment(ctx.text, found) ?? hookedBy
      livedHighlights.push(seg.hit)
      if (selfLink.startsWith('Пока')) selfLink = `Читаю и думаю: да, это про людей как я`
    } else if (!['rural', 'udmurt_speaker'].includes(portrait.segmentId)) {
      livedMissing.push(seg.miss)
      if (selfLink.startsWith('Пока') || selfLink.includes('как я')) {
        selfLink = `Не вижу себя в этом посте — ${seg.miss.toLowerCase()}`
      }
    }
  }

  if (portrait.segmentId === 'kindergarten_parent') {
    const daycare = ['детсад', 'дошкольн', 'малыш', 'садик', 'ясли']
    const found = daycare.find((w) => ctx.lower.includes(w))
    if (found) {
      hookedBy = quoteFragment(ctx.text, found) ?? hookedBy
      livedHighlights.push('мамочки, про садик/малыша — моя тема')
      selfLink = 'пишут про то чем живу каждый день — ребёнок'
    } else {
      livedMissing.push('не про малыша — тема мимо')
    }
  }

  const official = findOfficialFragment(ctx.text)
  if (official && ['school', 'student', 'worker', 'senior', 'rural'].includes(portrait.segmentId)) {
    turnedOffBy = official
    livedMissing.push(`${official} — канцелярит, не как живой человек пишет`)
    if (selfLink.startsWith('Пока') || selfLink.startsWith('ну типа')) selfLink = 'как из пресс-релиза, не про мою жизнь'
  }

  if (ctx.federalHits.length > 0) {
    const fed = ctx.federalHits[0]
    turnedOffBy = quoteFragment(ctx.text, fed) ?? turnedOffBy
    livedMissing.push(`«${fed}» — из москвы, не из нашей республики`)
  }

  if (!hookedBy && opener.length > 15 && livedHighlights.length === 0) {
    if (['student', 'young_pro', 'parent'].includes(portrait.segmentId)) {
      hookedBy = `«${opener}»`
      livedHighlights.push('первая фраза зацепила — дочитаю')
    }
  }

  if (portrait.age < 22 && ctx.words > 180) {
    turnedOffBy = turnedOffBy ?? `«${firstSentence(ctx.text).slice(0, 40)}…»`
    livedMissing.push('слишком много букв — в ленте не дочитываю, пролистну')
    selfLink = 'некогда вчитываться — формат не для меня'
  }

  if (portrait.age > 55) {
    const slang = ['кринж', 'имба', 'рофл', 'чел', 'лол']
    const s = slang.find((w) => ctx.lower.includes(w))
    if (s) {
      turnedOffBy = quoteFragment(ctx.text, s) ?? turnedOffBy
      livedMissing.push(`Слово «${s}» — молодёжное, мне непонятно и отталкивает`)
    }
  }

  if (livedHighlights.length === 0 && livedMissing.length === 0) {
    livedMissing.push('Прочитал — не нашёл, где тут я и моя повседневность')
  }

  return { hookedBy, turnedOffBy, selfLink, livedHighlights, livedMissing }
}

function readingScene(portrait: NeuroPortrait): string {
  if (isPreset(portrait.segmentId)) {
    const tpl = VOICE_REACTION_TEMPLATES[portrait.segmentId]
    const pub = portrait.localPublics?.[0]
    const scene = pick(tpl.scene, portrait.id + 'scene')
    return pub ? `${scene} (${pub})` : scene
  }
  const ch = portrait.channels[0] ?? 'соцсети'
  return `Увидел в ${ch}`
}

function actionVerdict(
  portrait: NeuroPortrait,
  overall: number,
  ctx: HeuristicCtx,
): { wouldShare: boolean; wouldComment: boolean; wouldScrollPast: boolean; action: string } {
  const wouldScrollPast = overall < 40
  const wouldComment = ctx.hasQuestion && overall >= 50
  const wouldShare = overall >= 70 && (ctx.localHits.length > 0 || cityMentioned(portrait, ctx.lower))

  let action: string
  if (wouldScrollPast) action = 'пролистает, даже не дочитав'
  else if (wouldShare) action = 'сохранит и перешлёт знакомым'
  else if (wouldComment) action = 'напишет в комментариях'
  else if (overall >= 60) action = 'дочитает и запомнит'
  else action = 'дочитает без эмоций и закроет'

  return { wouldShare, wouldComment, wouldScrollPast, action }
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
  return emotion
}

export function portraitScoreBias(portrait: NeuroPortrait, ctx: HeuristicCtx): {
  engagement: number
  trust: number
  relevance: number
} {
  let engagement = hashJitter(portrait.id + 'e', -8, 8)
  let trust = hashJitter(portrait.id + 't', -6, 6)
  let relevance = hashJitter(portrait.id + 'r', -7, 7)

  if (cityMentioned(portrait, ctx.lower)) {
    relevance += 14
    trust += 6
  }
  if (ctx.lower.includes(portrait.favoritePlace.toLowerCase().slice(0, 8))) relevance += 8
  if (portrait.age < 20 && ctx.words > 150) engagement -= 6
  if (portrait.age > 55 && ctx.words > 120) trust -= 5

  return { engagement, trust, relevance }
}

function voicedSelfLink(portrait: NeuroPortrait, read: FormulationRead): string {
  if (!isPreset(portrait.segmentId)) return read.selfLink
  const tpl = VOICE_REACTION_TEMPLATES[portrait.segmentId]
  const template = pick(tpl.selfLink, portrait.id + 'self')
  return fillTpl(template, { city: portrait.city })
}

function voicedHook(
  portrait: NeuroPortrait,
  quote: string | null,
  positive: boolean,
): string | null {
  if (!quote || !isPreset(portrait.segmentId)) return quote
  const tpl = VOICE_REACTION_TEMPLATES[portrait.segmentId]
  const pool = positive ? tpl.hookPositive : tpl.hookNegative
  return fillTpl(pick(pool, portrait.id + (positive ? 'hp' : 'hn')), { quote })
}

function voicedAction(portrait: NeuroPortrait, verdict: ReturnType<typeof actionVerdict>, overall: number): string {
  if (!isPreset(portrait.segmentId)) {
    if (verdict.wouldScrollPast) return 'Пролистаю — не трачу время.'
    if (verdict.wouldShare) return 'Скину знакомым — им тоже актуально.'
    if (verdict.wouldComment) return 'Могу написать в комментариях.'
    if (overall >= 55) return 'Дочитаю и пойду дальше.'
    return 'Дочитаю без эмоций.'
  }
  const tpl = VOICE_REACTION_TEMPLATES[portrait.segmentId]
  if (verdict.wouldScrollPast) return pick(tpl.actionScroll, portrait.id + 'scroll')
  if (verdict.wouldShare) return pick(tpl.actionShare, portrait.id + 'share')
  if (verdict.wouldComment) return pick(tpl.actionComment, portrait.id + 'comment')
  if (overall >= 55) return pick(tpl.actionRead, portrait.id + 'read')
  return pick(tpl.actionRead, portrait.id + 'read2')
}

export function buildPersonaNarrative(
  portrait: NeuroPortrait,
  sentiment: 'positive' | 'neutral' | 'negative',
  overall: number,
  _missing: string[],
  _highlights: string[],
  ctx: HeuristicCtx,
): PersonaNarrative {
  const emotion = emotionFor(sentiment, portrait, ctx)
  const readingContext = readingScene(portrait)
  const read = readFormulations(portrait, ctx)
  const verdict = actionVerdict(portrait, overall, ctx)
  const profile = voiceFor(portrait)

  const wants = stylizeForSegment(portrait, voicedSelfLink(portrait, read), portrait.id + 'wants')

  const hookedVoice = voicedHook(portrait, read.hookedBy, true)
  const turnedVoice = voicedHook(portrait, read.turnedOffBy, false)

  const firstImpression = hookedVoice
    ? `${readingContext}. ${hookedVoice}`
    : turnedVoice
      ? `${readingContext}. ${turnedVoice}`
      : stylizeForSegment(
          portrait,
          pick(
            isPreset(portrait.segmentId)
              ? VOICE_REACTION_TEMPLATES[portrait.segmentId].scene.map((s) => `${s}… ну не ясно пока, моё ли`)
              : [`${readingContext}. Не ясно, моё ли это`],
            portrait.id + 'fi',
          ),
          portrait.id + 'fi',
        )

  const actionLine = voicedAction(portrait, verdict, overall)

  const summary = [
    `${portrait.name}, ${portrait.age}, ${portrait.city} — ${verdict.action}.`,
    hookedVoice ? `Зацепило: ${hookedVoice}` : null,
    turnedVoice ? `Оттолкнуло: ${turnedVoice}` : null,
    wants,
  ].filter(Boolean).join(' ')

  const monoParts: string[] = [readingContext + '.']

  if (hookedVoice) {
    monoParts.push(hookedVoice + '.')
    if (read.livedHighlights[0]) {
      monoParts.push(stylizeForSegment(portrait, read.livedHighlights[0], portrait.id + 'hl'))
    }
  } else if (turnedVoice) {
    monoParts.push(turnedVoice + '.')
  } else {
    monoParts.push(firstImpression)
  }

  monoParts.push(wants + '.')
  monoParts.push(actionLine)

  if (profile && portrait.localMeme && sentiment === 'positive' && hashJitter(portrait.id, 0, 3) === 0) {
    monoParts.push(stylizeForSegment(portrait, `кстати напомнило ${portrait.localMeme}`, portrait.id + 'meme'))
  }

  const livedHighlights = read.livedHighlights.map((h, i) =>
    stylizeForSegment(portrait, h, portrait.id + 'lh' + i),
  )
  const livedMissing = read.livedMissing.map((m, i) =>
    stylizeForSegment(portrait, m, portrait.id + 'lm' + i),
  )

  return {
    emotion,
    wants,
    firstImpression,
    readingContext,
    hookedBy: read.hookedBy,
    turnedOffBy: read.turnedOffBy,
    summary,
    innerMonologue: monoParts.join(' '),
    livedHighlights,
    livedMissing,
  }
}