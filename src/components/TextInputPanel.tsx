import { CONTENT_TYPES } from '../data/segments'
import type { ContentType, TestMode, UploadedImage } from '../types'
import { ImageUpload } from './ImageUpload'

const PRIMARY_TYPES: ContentType[] = ['post', 'stories']
const EXTRA_TYPES = CONTENT_TYPES.filter((t) => !PRIMARY_TYPES.includes(t.id))

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
  loadingStep: string | null
  portraitCount: number
  canTest: boolean
  testHint: string | null
  sampleText: string
  onModeChange: (mode: TestMode) => void
  onTextChange: (text: string) => void
  onTextBChange: (text: string) => void
  onImagesAdd: (images: UploadedImage[]) => void
  onImageRemove: (id: string) => void
  onContentTypeChange: (type: ContentType) => void
  onUseOllamaChange: (v: boolean) => void
  onTest: () => void
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
  loadingStep,
  portraitCount,
  canTest,
  testHint,
  sampleText,
  onModeChange,
  onTextChange,
  onTextBChange,
  onImagesAdd,
  onImageRemove,
  onContentTypeChange,
  onUseOllamaChange,
  onTest,
}: TextInputPanelProps) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const wordCountB = textB.trim().split(/\s+/).filter(Boolean).length

  return (
    <section className="glass rounded-2xl p-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">2. Пост для теста</h2>
          <p className="text-xs text-slate-500 mt-0.5">Информационные посты — без требования «подписывайтесь» и CTA</p>
        </div>
        <div className="flex rounded-lg bg-surface-3 p-0.5 border border-border">
          <button
            type="button"
            onClick={() => onModeChange('single')}
            className={`px-3 py-1 rounded-md text-xs font-medium ${mode === 'single' ? 'bg-indigo-500/30 text-indigo-200' : 'text-slate-400'}`}
          >
            Один пост
          </button>
          <button
            type="button"
            onClick={() => onModeChange('compare')}
            className={`px-3 py-1 rounded-md text-xs font-medium ${mode === 'compare' ? 'bg-indigo-500/30 text-indigo-200' : 'text-slate-400'}`}
          >
            A / B
          </button>
        </div>
      </div>

      <div className="mb-3">
        <span className="text-xs text-slate-500 block mb-1.5">Формат публикации</span>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.filter((t) => PRIMARY_TYPES.includes(t.id)).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onContentTypeChange(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                contentType === t.id
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-surface-3 border-border text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
          <select
            value={EXTRA_TYPES.some((t) => t.id === contentType) ? contentType : ''}
            onChange={(e) => {
              if (e.target.value) onContentTypeChange(e.target.value as ContentType)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs border bg-surface-3 focus:outline-none ${
              EXTRA_TYPES.some((t) => t.id === contentType)
                ? 'border-indigo-500/40 text-indigo-200'
                : 'border-border text-slate-500'
            }`}
          >
            <option value="" disabled>Другой формат…</option>
            {EXTRA_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'single' ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-slate-500">Текст поста</label>
            {!text.trim() && (
              <button
                type="button"
                onClick={() => onTextChange(sampleText)}
                className="text-xs text-indigo-300 hover:text-indigo-200"
              >
                Вставить пример
              </button>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Скопируйте пост из VK, Telegram или MAX — как будет у подписчиков…"
            rows={12}
            className="w-full px-4 py-3 rounded-xl bg-surface-3 border border-border text-white text-sm leading-relaxed focus:border-indigo-500 focus:outline-none resize-y min-h-[200px]"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-slate-500">{wordCount} слов</span>
            {wordCount > 0 && wordCount < 11 && (
              <span className="text-xs text-amber-400/90">Минимум 11 символов для теста</span>
            )}
          </div>
        </>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-cyan-400 mb-1 block">Пост A · {wordCount} слов</label>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Исходный пост…"
              rows={10}
              className="w-full px-3 py-2 rounded-xl bg-surface-3 border border-cyan-500/20 text-white text-sm focus:border-cyan-500/50 focus:outline-none resize-y"
            />
          </div>
          <div>
            <label className="text-xs text-violet-400 mb-1 block">Пост B · {wordCountB} слов</label>
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
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">Фото к посту (необязательно)</p>
          <ImageUpload images={images} onAdd={onImagesAdd} onRemove={onImageRemove} />
        </div>
      )}

      <p className="text-[11px] text-slate-600 mt-3">{analysisMode}</p>

      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-border/60">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={useOllama}
            disabled={!ollamaAvailable}
            onChange={(e) => onUseOllamaChange(e.target.checked)}
            className="rounded border-border"
          />
          Углублённый AI (Ollama)
          {!ollamaAvailable && <span className="text-xs text-slate-600">— эвристика активна</span>}
        </label>

        <div className="flex flex-col items-end gap-1">
          {testHint && !loading && (
            <span className="text-xs text-amber-400/90">{testHint}</span>
          )}
          {!loading && canTest && portraitCount > 0 && (
            <span className="text-[10px] text-slate-600">
              {portraitCount} {portraitCount === 1 ? 'портрет' : portraitCount < 5 ? 'портрета' : 'портретов'}
            </span>
          )}
          {loading && loadingStep && (
            <span className="text-xs text-cyan-300/80">{loadingStep}</span>
          )}
          <button
            type="button"
            onClick={onTest}
            disabled={!canTest || loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (loadingStep ?? 'Анализ поста…') : mode === 'compare' ? 'Сравнить посты' : 'Проверить пост'}
          </button>
        </div>
      </div>
    </section>
  )
}