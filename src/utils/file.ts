import type { UploadedImage } from '../types'

export function fileToUploadedImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        previewUrl: dataUrl,
        base64,
        mimeType: file.type || 'image/jpeg',
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}