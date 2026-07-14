import type { ContentType, ImageAnalysis, UploadedImage } from '../types'
import { describeImageWithVision } from './ollama'

const LOCAL_VISUAL_MARKERS = [
  'ижевск', 'удмурт', 'кама', 'лес', 'бёрдо', 'бердо', 'вотсин', 'пельме',
  'народн', 'орнамент', 'традиц', 'завод', 'пруд', 'сарапул',
]

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function analyzePixels(img: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  const size = 64
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data

  let r = 0, g = 0, b = 0, count = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  r /= count
  g /= count
  b /= count
  const brightness = (r + g + b) / 3

  return {
    brightness: brightness < 85 ? 'тёмное' as const : brightness > 170 ? 'светлое' as const : 'среднее' as const,
    warmth: r > b + 15 ? 'тёплые тона' as const : b > r + 15 ? 'холодные тона' as const : 'нейтральные' as const,
  }
}

function aspectLabel(w: number, h: number): string {
  const ratio = w / h
  if (ratio > 1.5) return 'горизонтальный (баннер)'
  if (ratio < 0.7) return 'вертикальный (Stories/Reels)'
  return 'квадратный (пост)'
}

function checkAspectFit(aspect: string, contentType: ContentType): string[] {
  const warnings: string[] = []
  if (contentType === 'stories' && !aspect.includes('вертикальный')) {
    warnings.push('Для Stories лучше вертикальный формат 9:16')
  }
  if (contentType === 'post' && aspect.includes('вертикальный')) {
    warnings.push('Вертикалка в ленте поста может обрезаться — проверьте кроп')
  }
  return warnings
}

function extractLocalMarkers(text: string): string[] {
  const lower = text.toLowerCase()
  return LOCAL_VISUAL_MARKERS.filter((m) => lower.includes(m))
}

function buildTextImageSync(text: string, imageDesc: string, localInImage: string[]): string {
  const textLower = text.toLowerCase()
  if (!imageDesc) return 'Изображение не загружено'
  if (localInImage.length && !LOCAL_VISUAL_MARKERS.some((m) => textLower.includes(m))) {
    return 'Картинка локальная, а текст — нет: усильте связку'
  }
  if (localInImage.length) return 'Текст и визуал дополняют друг друга по локальному контексту'
  return 'Визуал нейтральный — текст несёт основную нагрузку'
}

export async function analyzeImage(
  image: UploadedImage,
  text: string,
  contentType: ContentType,
  useVision: boolean,
): Promise<ImageAnalysis> {
  const img = await loadImage(image.previewUrl)
  const pixels = analyzePixels(img)
  const aspect = aspectLabel(img.width, img.height)
  const warnings = checkAspectFit(aspect, contentType)

  let description = `Изображение ${img.width}×${img.height}, ${aspect}, ${pixels.brightness}, ${pixels.warmth}.`
  let source: ImageAnalysis['source'] = 'heuristic'

  if (useVision) {
    const visionDesc = await describeImageWithVision(
      image.base64,
      image.mimeType,
      `Тип контента: ${contentType}. Текст поста: ${text.slice(0, 300)}`,
    )
    if (visionDesc) {
      description = visionDesc
      source = 'vision'
    }
  }

  const localMarkers = extractLocalMarkers(description)
  let udmurtiaFitScore = 50
  if (localMarkers.length) udmurtiaFitScore += localMarkers.length * 12
  if (pixels.warmth === 'тёплые тона') udmurtiaFitScore += 8
  if (warnings.length) udmurtiaFitScore -= warnings.length * 10
  udmurtiaFitScore = Math.max(0, Math.min(100, udmurtiaFitScore))

  if (!localMarkers.length) {
    warnings.push('На визуале не видно удмуртских маркеров — добавьте локальные детали')
  }

  return {
    fileName: image.name,
    width: img.width,
    height: img.height,
    aspectLabel: aspect,
    brightness: pixels.brightness,
    warmth: pixels.warmth,
    description,
    localMarkers,
    warnings,
    textImageSync: buildTextImageSync(text, description, localMarkers),
    udmurtiaFitScore,
    source,
  }
}

export async function analyzeImages(
  images: UploadedImage[],
  text: string,
  contentType: ContentType,
  useVision: boolean,
): Promise<ImageAnalysis[]> {
  return Promise.all(images.map((img) => analyzeImage(img, text, contentType, useVision)))
}

export function imageContextForPrompt(analyses: ImageAnalysis[]): string {
  return analyses.map((a) =>
    `Файл: ${a.fileName}. ${a.description}. Синхрон с текстом: ${a.textImageSync}. Оценка Удмуртии: ${a.udmurtiaFitScore}%`,
  ).join('\n')
}