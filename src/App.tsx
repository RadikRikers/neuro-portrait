import { useCallback, useEffect, useMemo, useState } from 'react'
import { AudiencePanel } from './components/AudiencePanel'
import { CompareResults } from './components/CompareResults'
import { Header } from './components/Header'
import { TestResults } from './components/TestResults'
import { TextInputPanel } from './components/TextInputPanel'
import { ALL_ZONE_IDS, AUDIENCE_SEGMENTS } from './data/segments'
import type {
  AudienceSegment,
  AudienceSegmentId,
  CompareResult,
  ContentType,
  PresetSegmentId,
  TestMode,
  TextTestResult,
  UploadedImage,
  UdmurtiaZone,
} from './types'
import { compareResults } from './utils/compare'
import { isOllamaAvailable, pickVisionModel } from './utils/ollama'
import { generatePortraits } from './utils/personas'
import { loadCustomSegments, saveCustomSegments } from './utils/segment-registry'
import { testText } from './utils/test-text'

const DEFAULT_SEGMENTS: PresetSegmentId[] = ['student', 'worker', 'parent', 'udmurt_speaker']

const SAMPLE_TEXT = `Вожкы озон!

Мы запускаем новую программу для жителей Ижевска. Это возможность узнать больше о культуре Удмуртии и принять участие в интересных событиях.

Подробности скоро. Следите за обновлениями.`

export default function App() {
  const [selectedSegments, setSelectedSegments] = useState<AudienceSegmentId[]>(DEFAULT_SEGMENTS)
  const [customSegments, setCustomSegments] = useState<AudienceSegment[]>(() => loadCustomSegments())
  const [selectedZones, setSelectedZones] = useState<UdmurtiaZone[]>(ALL_ZONE_IDS)
  const [mode, setMode] = useState<TestMode>('single')
  const [text, setText] = useState('')
  const [textB, setTextB] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [contentType, setContentType] = useState<ContentType>('post')
  const [useOllama, setUseOllama] = useState(true)
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  const [hasVision, setHasVision] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TextTestResult | null>(null)
  const [compare, setCompare] = useState<CompareResult | null>(null)

  const portraits = useMemo(
    () => generatePortraits(selectedSegments, selectedZones, customSegments),
    [selectedSegments, selectedZones, customSegments],
  )

  const analysisMode = useMemo(() => {
    if (ollamaAvailable && useOllama) {
      return hasVision
        ? 'Режим: AI-текст + AI-зрение (Ollama). Полный анализ.'
        : 'Режим: AI-текст (Ollama) + эвристика изображений.'
    }
    return 'Режим: эвристика — работает на Vercel без сервера. Для AI подключите Ollama.'
  }, [ollamaAvailable, useOllama, hasVision])

  useEffect(() => {
    isOllamaAvailable().then(async (ok) => {
      setOllamaAvailable(ok)
      if (ok) setHasVision(Boolean(await pickVisionModel()))
    })
  }, [])

  useEffect(() => {
    saveCustomSegments(customSegments)
  }, [customSegments])

  const clearResults = () => {
    setResult(null)
    setCompare(null)
  }

  const toggleSegment = useCallback((id: AudienceSegmentId) => {
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
    clearResults()
  }, [])

  const handleAddCustom = (segment: AudienceSegment) => {
    setCustomSegments((prev) => [...prev, segment])
    setSelectedSegments((prev) => [...prev, segment.id])
    clearResults()
  }

  const handleRemoveCustom = (id: AudienceSegmentId) => {
    setCustomSegments((prev) => prev.filter((s) => s.id !== id))
    setSelectedSegments((prev) => prev.filter((s) => s !== id))
    clearResults()
  }

  const handleTest = async () => {
    if (selectedSegments.length === 0) return
    setLoading(true)
    clearResults()

    const ollama = useOllama && ollamaAvailable

    try {
      if (mode === 'single') {
        if (!text.trim()) return
        const testResult = await testText(text, portraits, contentType, selectedZones, ollama, customSegments, images)
        setResult(testResult)
      } else {
        if (!text.trim() || !textB.trim()) return
        const [resultA, resultB] = await Promise.all([
          testText(text, portraits, contentType, selectedZones, ollama, customSegments, images),
          testText(textB, portraits, contentType, selectedZones, ollama, customSegments, images),
        ])
        setCompare(compareResults(resultA, resultB))
      }
    } finally {
      setLoading(false)
    }
  }

  const canTest =
    selectedSegments.length > 0 &&
    selectedZones.length > 0 &&
    (mode === 'single' ? text.trim().length > 10 : text.trim().length > 10 && textB.trim().length > 10)

  return (
    <div className="min-h-screen bg-surface">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
            Тестируйте тексты и{' '}
            <span className="gradient-text">фото</span> на нейро-портретах
          </h2>
          <p className="text-sm text-slate-400">
            Текст + изображения, прогноз отклика, сравнение A/B, отчёт в .txt
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <AudiencePanel
              selectedSegments={selectedSegments}
              customSegments={customSegments}
              selectedZones={selectedZones}
              portraits={portraits}
              onToggleSegment={toggleSegment}
              onToggleZone={(z) => {
                setSelectedZones((prev) =>
                  prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z],
                )
                clearResults()
              }}
              onSelectAllZones={() => { setSelectedZones(ALL_ZONE_IDS); clearResults() }}
              onSelectAll={() => setSelectedSegments([
                ...AUDIENCE_SEGMENTS.map((s) => s.id),
                ...customSegments.map((s) => s.id),
              ])}
              onAddCustom={handleAddCustom}
              onRemoveCustom={handleRemoveCustom}
            />
          </div>

          <div className="lg:col-span-3 space-y-5">
            <TextInputPanel
              mode={mode}
              text={text}
              textB={textB}
              images={images}
              contentType={contentType}
              useOllama={useOllama}
              ollamaAvailable={ollamaAvailable}
              analysisMode={analysisMode}
              loading={loading}
              onModeChange={(m) => { setMode(m); clearResults() }}
              onTextChange={(t) => { setText(t); clearResults() }}
              onTextBChange={(t) => { setTextB(t); clearResults() }}
              onImagesAdd={(imgs) => { setImages((prev) => [...prev, ...imgs]); clearResults() }}
              onImageRemove={(id) => { setImages((prev) => prev.filter((i) => i.id !== id)); clearResults() }}
              onContentTypeChange={setContentType}
              onUseOllamaChange={setUseOllama}
              onTest={handleTest}
              canTest={canTest}
            />

            {!text && mode === 'single' && (
              <button
                type="button"
                onClick={() => setText(SAMPLE_TEXT)}
                className="text-xs text-slate-500 hover:text-indigo-300"
              >
                Вставить пример текста
              </button>
            )}

            {compare && <CompareResults compare={compare} />}

            {result && !compare && <TestResults result={result} />}
          </div>
        </div>
      </main>
    </div>
  )
}