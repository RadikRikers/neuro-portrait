import type { AudienceSegment, AudienceSegmentId, NeuroPortrait, PresetSegmentId, UdmurtiaZone } from '../types'
import { getSegmentById } from './segment-registry'

const NAMES: Record<PresetSegmentId, string[]> = {
  school: ['Маша', 'Кирилл', 'Алина'],
  student: ['Артём', 'Дарья', 'Тимур'],
  young_pro: ['Никита', 'Елена', 'Руслан'],
  worker: ['Сергей', 'Надежда', 'Виктор'],
  parent: ['Ольга', 'Андрей', 'Светлана'],
  kindergarten_parent: ['Анна', 'Игорь', 'Марина'],
  senior: ['Валентина', 'Пётр', 'Зинаида'],
  rural: ['Парван', 'Нюргая', 'Геннадий'],
  udmurt_speaker: ['Вера', 'Тюбар', 'Айса'],
}

const OCCUPATIONS: Record<PresetSegmentId, string[]> = {
  school: ['Школьница, 9 класс', 'Школьник, 10 класс', 'Школьница, 11 класс'],
  student: ['Студент ИжГТУ', 'Студентка УдГУ', 'Студент колледжа'],
  young_pro: ['SMM-менеджер', 'Разработчик', 'Маркетолог'],
  worker: ['Токарь на заводе', 'Оператор производства', 'Мастер смены'],
  parent: ['Мама двоих детей', 'Папа школьника', 'Родитель подростка'],
  kindergarten_parent: ['Мама ребёнка 4 лет', 'Папа дошкольника', 'Родительница двоих малышей'],
  senior: ['Пенсионер, бывший инженер', 'Пенсионерка, педагог', 'Пенсионер, ветеран труда'],
  rural: ['Фермер', 'Учитель в сельской школе', 'Заведующая клубом в селе'],
  udmurt_speaker: ['Преподаватель удмуртского', 'Фольклорный ансамбль', 'Краевед'],
}

const AGE_BY_SEGMENT: Record<PresetSegmentId, number> = {
  school: 16,
  student: 21,
  young_pro: 29,
  worker: 42,
  parent: 38,
  kindergarten_parent: 32,
  senior: 63,
  rural: 45,
  udmurt_speaker: 48,
}

const CITIES: Record<UdmurtiaZone, string[]> = {
  izhevsk: ['Ижевск', 'Ижевск', 'Ижевск'],
  sarapul: ['Сарапул', 'Сарапул', 'Ижевск'],
  votkinsk: ['Воткинск', 'Воткинск', 'Ижевск'],
  glazov: ['Глазов', 'Глазов', 'Ижевск'],
  mozhga: ['Можга', 'Можга', 'Селты'],
  rural: ['Селты', 'Шаркан', 'Кез'],
}

const PLACES: Record<UdmurtiaZone, string[]> = {
  izhevsk: ['Набережная Ижевского пруда', 'Центральный рынок', 'Парк Металлургов'],
  sarapul: ['Набережная Камы', 'Старый Сарапул', 'Театр'],
  votkinsk: ['Музей Чайковского', 'Воткинское водохранилище', 'Парк Победы'],
  glazov: ['Набережная Чепцы', 'Городской сквер', 'Промышленный район'],
  mozhga: ['Парк Можги', 'Сельская ярмарка', 'Районный центр'],
  rural: ['Вотсина', 'Священная роща', 'Сельский клуб'],
}

const GENERIC_NAMES = ['Айдар', 'Лилия', 'Илья', 'Гульнара', 'Роман']

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function parseAgeMid(ageRange: string): number {
  const nums = ageRange.match(/\d+/g)?.map(Number) ?? [30]
  if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2)
  return nums[0] ?? 30
}

function isPreset(id: AudienceSegmentId): id is PresetSegmentId {
  return id in NAMES
}

export function generatePortrait(
  segmentId: AudienceSegmentId,
  zone: UdmurtiaZone,
  customSegments: AudienceSegment[],
  index = 0,
): NeuroPortrait {
  const segment = getSegmentById(segmentId, customSegments)
  const city = pick(CITIES[zone], index)
  const place = pick(PLACES[zone], index)

  const name = isPreset(segmentId) ? pick(NAMES[segmentId], index) : pick(GENERIC_NAMES, index)
  const age = isPreset(segmentId)
    ? AGE_BY_SEGMENT[segmentId] + (index % 3) - 1
    : parseAgeMid(segment.ageRange)
  const occupation = isPreset(segmentId)
    ? pick(OCCUPATIONS[segmentId], index)
    : `Представитель: ${segment.label}`

  return {
    id: `${segmentId}-${index}`,
    segmentId,
    segmentLabel: segment.label,
    name,
    age,
    city,
    occupation,
    bio: `${name}, ${segment.label.toLowerCase()} из ${city}. ${segment.description}`,
    favoritePlace: place,
    values: segment.values,
    painPoints: segment.painPoints,
    languageStyle: segment.languageExpectations.join(', '),
    channels: segment.channels,
  }
}

export function generatePortraits(
  segmentIds: AudienceSegmentId[],
  zones: UdmurtiaZone[],
  customSegments: AudienceSegment[] = [],
): NeuroPortrait[] {
  const effective = zones.length ? zones : (['izhevsk'] as UdmurtiaZone[])
  return segmentIds.map((id, i) => generatePortrait(id, effective[i % effective.length], customSegments, i))
}