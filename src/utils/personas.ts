import { PERSONA_CATALOG } from '../data/persona-catalog'
import type { PortraitsPerSegment } from './analysis-settings'
import { DEFAULT_ANALYSIS_SETTINGS } from './analysis-settings'
import { getVoiceProfile, isPresetSegment } from '../data/udmurtia-voices'
import type { AudienceSegment, AudienceSegmentId, NeuroPortrait, PresetSegmentId, UdmurtiaZone } from '../types'
import { getSegmentById } from './segment-registry'

const CITIES: Record<UdmurtiaZone, string[]> = {
  izhevsk: ['Ижевск', 'Ижевск', 'Ижевск', 'Ижевск', 'Ижевск'],
  sarapul: ['Сарапул', 'Сарапул', 'Ижевск', 'Воткинск', 'Сарапул'],
  votkinsk: ['Воткинск', 'Воткинск', 'Ижевск', 'Глазов', 'Воткинск'],
  glazov: ['Глазов', 'Глазов', 'Ижевск', 'Можга', 'Глазов'],
  mozhga: ['Можга', 'Можга', 'Селты', 'Ижевск', 'Можга'],
  rural: ['Селты', 'Шаркан', 'Кез', 'Воткинск', 'Яр'],
}

const PLACES: Record<UdmurtiaZone, string[]> = {
  izhevsk: ['Набережная Ижевского пруда', 'Центральный рынок', 'Парк Металлургов', 'Удмуртия Арена', 'Площадь Дружбы'],
  sarapul: ['Набережная Камы', 'Старый Сарапул', 'Театр', 'Камский берег', 'Рынок'],
  votkinsk: ['Музей Чайковского', 'Воткинское водохранилище', 'Парк Победы', 'Набережная', 'Заводской район'],
  glazov: ['Набережная Чепцы', 'Городской сквер', 'Промышленный район', 'Вокзал', 'Парк'],
  mozhga: ['Парк Можги', 'Сельская ярмарка', 'Районный центр', 'Площадь', 'Клуб'],
  rural: ['Вотсина', 'Священная роща', 'Сельский клуб', 'Ферма', 'Школа'],
}

const GENERIC_NAMES = ['Айдар', 'Лилия', 'Илья', 'Гульнара', 'Роман', 'Динара', 'Фёдор']

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function parseAgeMid(ageRange: string): number {
  const nums = ageRange.match(/\d+/g)?.map(Number) ?? [30]
  if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2)
  return nums[0] ?? 30
}

function isPreset(id: AudienceSegmentId): id is PresetSegmentId {
  return id in PERSONA_CATALOG
}

export function generatePortrait(
  segmentId: AudienceSegmentId,
  zone: UdmurtiaZone,
  customSegments: AudienceSegment[],
  variantIndex = 0,
  globalIndex = 0,
): NeuroPortrait {
  const segment = getSegmentById(segmentId, customSegments)
  const city = pick(CITIES[zone], globalIndex + variantIndex)
  const place = pick(PLACES[zone], globalIndex + variantIndex)

  const catalog = isPreset(segmentId) ? PERSONA_CATALOG[segmentId] : null
  const name = catalog
    ? pick(catalog.names, variantIndex)
    : pick(GENERIC_NAMES, variantIndex)
  const age = catalog
    ? catalog.baseAge + (variantIndex % 5) - 2
    : parseAgeMid(segment.ageRange)
  const occupation = catalog
    ? pick(catalog.occupations, variantIndex)
    : `Представитель: ${segment.label}`

  const voice = isPresetSegment(segmentId) ? getVoiceProfile(segmentId) : null
  const bio = catalog
    ? pick(catalog.bios, variantIndex).replace(/Ижевск/g, city)
    : `${name}, ${segment.label.toLowerCase()} из ${city}. ${segment.description}`

  return {
    id: `${segmentId}-v${variantIndex}-z${zone}`,
    segmentId,
    segmentLabel: segment.label,
    name,
    age,
    city,
    occupation,
    bio,
    favoritePlace: place,
    values: segment.values,
    painPoints: segment.painPoints,
    languageStyle: voice
      ? `${voice.voiceInstruction} Паразиты: ${voice.fillers.slice(0, 4).join(', ')}.`
      : segment.languageExpectations.join(', '),
    channels: segment.channels,
    localPublics: voice?.localPublics,
    localMeme: voice?.localMeme,
    speechMarkers: voice ? [...voice.fillers.slice(0, 3), ...voice.slang.slice(0, 4)] : undefined,
  }
}

/** Нейро-портреты на каждый выбранный сегмент (количество задаётся в настройках) */
export function generatePortraits(
  segmentIds: AudienceSegmentId[],
  zones: UdmurtiaZone[],
  customSegments: AudienceSegment[] = [],
  portraitsPerSegment: PortraitsPerSegment = DEFAULT_ANALYSIS_SETTINGS.portraitsPerSegment,
): NeuroPortrait[] {
  const effective = zones.length ? zones : (['izhevsk'] as UdmurtiaZone[])
  const portraits: NeuroPortrait[] = []

  segmentIds.forEach((segmentId, segIdx) => {
    for (let v = 0; v < portraitsPerSegment; v++) {
      const zone = effective[(segIdx + v) % effective.length]
      portraits.push(generatePortrait(segmentId, zone, customSegments, v, segIdx * portraitsPerSegment + v))
    }
  })

  return portraits
}