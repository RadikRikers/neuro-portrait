import type { UploadedImage } from '../types'

interface ImageUploadProps {
  images: UploadedImage[]
  onAdd: (images: UploadedImage[]) => void
  onRemove: (id: string) => void
  maxFiles?: number
}

const MAX_IMAGES = 10

export function ImageUpload({ images, onAdd, onRemove, maxFiles = MAX_IMAGES }: ImageUploadProps) {
  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const remaining = maxFiles - images.length
    const toProcess = Array.from(files).slice(0, remaining).filter((f) => f.type.startsWith('image/'))
    if (!toProcess.length) return

    const { fileToUploadedImage } = await import('../utils/file')
    const uploaded = await Promise.all(toProcess.map(fileToUploadedImage))
    onAdd(uploaded)
  }

  return (
    <div className="mt-3">
      <span className="text-xs text-slate-500 mb-2 block">Изображения к посту (до {maxFiles})</span>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.previewUrl}
                alt={img.name}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-xs opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
              <span className="text-[10px] text-slate-600 block truncate w-20">{img.name}</span>
            </div>
          ))}
        </div>
      )}

      {images.length < maxFiles && (
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-slate-400 hover:border-indigo-500/40 hover:text-indigo-300 cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          + Загрузить фото
        </label>
      )}
    </div>
  )
}