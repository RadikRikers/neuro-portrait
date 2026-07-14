import { CONTENT_TYPES } from '../data/segments'
import type { ContentType, TestMode, UploadedImage } from '../types'
import { ImageUpload } from './ImageUpload'

interface TextInputPanelProps {
  mode: TestMode
  text: string
  textB: string
  images: UploadedImage[]
  contentType: ContentType
  useOllama: boolean
  ollamaAvailable: boolean
  analysisMode: string
  loading: boolean
  onModeChange: (mode: TestMode) => void
  onTextChange: (text: string) => void
  onTextBChange: (text: string) => void
  onImagesAdd: (images: UploadedImage[]) => void
  onImageRemove: (id: string) => void
  onContentTypeChange: (type: ContentType) => void
  onUseOllamaChange: (v: boolean) => void
  onTest: () => void
  canTest: boolean
}

export function TextInputPanel({
  mode,
  text,
  textB,
  images,
  contentType,
  useOllama,
  ollamaAvailable,
  analysisMode,
  loading,
  onModeChange,
  onTextChange,
  onTextBChange,
  onImagesAdd,
  onImageRemove,
  onContentTypeChange,
  onUseOllamaChange,
  onTest,
  canTest,
}: TextInputPanelProps) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const wordCountB = textB.trim().split(/\s+/).filter(Boolean).length

  return (
    <section className="glass rounded-2xl p-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-white">2. Текст для теста</h2>
        <div className="flex rounded-lg bg-surface-3 p-0.5 border border-border">
          <button
            type="button"
            onClick={() => onModeChange('single')}
            className={`px-3 py-1 rounded-md text-xs font-medium ${mode === 'single' ? 'bg-indigo-500/30 text-indigo-200' : 'text-slate-400'}`}
          >
            Один текст
          </button>
          <button
            type="button"
            onClick={() => onModeChange('compare')}
            className={`px-3 py-1 rounded-md text-xs font-medium ${mode === 'compare' ? 'bg-indigo-500/30 text-indigo-200' : 'text-slate-400'}`}
          >
            Сравнить A / B
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <select
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value as ContentType)}
          className="px-3 py-2 rounded-lg bg-surface-3 border border-border text-white text-sm focus:border-indigo-500 focus:outline-none"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {mode === 'single' ? (
        <>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Вставьте пост, статью, сценарий Stories или рекламный текст…"
            rows={12}
            className="w-full px-4 py-3 rounded-xl bg-surface-3 border border-border text-white text-sm leading-relaxed focus:border-indigo-500 focus:outline-none resize-y min-h-[200px]"
          />
          <span className="text-xs text-slate-500 mt-1 inline-block">{wordCount} слов</span>
        </>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-cyan-400 mb-1 block">Вариант A · {wordCount} слов</label>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Исходный текст…"
              rows={10}
              className="w-full px-3 py-2 rounded-xl bg-surface-3 border border-cyan-500/20 text-white text-sm focus:border-cyan-500/50 focus:outline-none resize-y"
            />
          </div>
          <div>
            <label className="text-xs text-violet-400 mb-1 block">Вариант B · {wordCountB} слов</label>
            <textarea
              value={textB}
              onChange={(e) => onTextBChange(e.target.value)}
              placeholder="Улучшенная версия…"
              rows={10}
              className="w-full px-3 py-2 rounded-xl bg-surface-3 border border-violet-500/20 text-white text-sm focus:border-violet-500/50 focus:outline-none resize-y"
            />
          </div>
        </div>
      )}

      {mode === 'single' && (
        <ImageUpload images={images} onAdd={onImagesAdd} onRemove={onImageRemove} />
      )}

      <p className="text-[11px] text-slate-600 mt-2">{analysisMode}</p>

      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={useOllama}
            disabled={!ollamaAvailable}
            onChange={(e) => onUseOllamaChange(e.target.checked)}
            className="rounded border-border"
          />
          Углублённый AI (Ollama)
          {!ollamaAvailable && <span className="text-xs text-slate-600">— базовый анализ активен</span>}
        </label>

        <button
          type="button"
          onClick={onTest}
          disabled={!canTest || loading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Анализ…' : mode === 'compare' ? 'Сравнить варианты' : 'Проверить отклик'}
        </button>
      </div>
    </section>
  )
}