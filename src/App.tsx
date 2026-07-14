import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  loadAnalysisSettings,
  saveAnalysisSettings,
  type AnalysisSettings,
} from './utils/analysis-settings'
import { compareResults } from './utils/compare'
import { isOllamaAvailable, pickVisionModel } from './utils/ollama'
import { generatePortraits } from './utils/personas'
import { selectPortraitsForAnalysis } from './utils/select-portraits'
import { loadCustomSegments, saveCustomSegments } from './utils/segment-registry'
import { testText } from './utils/test-text'

const DEFAULT_SEGMENTS: PresetSegmentId[] = [
  'student', 'worker', 'parent', 'urban_mass',
  'svo_family_spouse', 'svo_veteran', 'opposition', 'udmurt_speaker',
]

const SAMPLE_TEXT = `Вожкы озон!

В Ижевске 20 июля откроется выставка удмуртского декоративно-прикладного искусства. Экспозиция разместится в Национальном музее им. К. Герасимова.

Вход свободный. Время работы: 10:00–18:00.`

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
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings>(() => loadAnalysisSettings())
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [result, setResult] = useState<TextTestResult | null>(null)
  const [compare, setCompare] = useState<CompareResult | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const portraits = useMemo(
    () => generatePortraits(
      selectedSegments,
      selectedZones,
      customSegments,
      analysisSettings.portraitsPerSegment,
    ),
    [selectedSegments, selectedZones, customSegments, analysisSettings.portraitsPerSegment],
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

  const handleAnalysisSettingsChange = useCallback((settings: AnalysisSettings) => {
    setAnalysisSettings(settings)
    saveAnalysisSettings(settings)
    clearResults()
  }, [])

  const buildAnalysisMeta = useCallback(() => {
    const poolSize = portraits.length
    const analyzedCount = selectPortraitsForAnalysis(
      portraits,
      analysisSettings.maxPortraitsForTest,
    ).length
    return {
      segmentCount: selectedSegments.length,
      portraitsPerSegment: analysisSettings.portraitsPerSegment,
      poolSize,
      analyzedCount,
      limited: analyzedCount < poolSize,
    }
  }, [portraits, selectedSegments.length, analysisSettings])

  const toggleSegment = useCallback((id: AudienceSegmentId) => {
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
    clearResults()
  }, [])

  const selectGroup = useCallback((ids: PresetSegmentId[]) => {
    setSelectedSegments((prev) => {
      const allSelected = ids.every((id) => prev.includes(id))
      if (allSelected) return prev.filter((s) => !ids.includes(s as PresetSegmentId))
      const merged = new Set([...prev, ...ids])
      return [...merged]
    })
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
    setLoadingStep('Подготовка…')
    clearResults()

    const ollama = useOllama && ollamaAvailable
    const analysisMeta = buildAnalysisMeta()
    const portraitsForTest = selectPortraitsForAnalysis(
      portraits,
      analysisSettings.maxPortraitsForTest,
    )
    const testOpts = {
      analysisMeta,
      onProgress: setLoadingStep,
    }

    try {
      if (mode === 'single') {
        if (!text.trim()) return
        const testResult = await testText(
          text,
          portraitsForTest,
          contentType,
          selectedZones,
          ollama,
          customSegments,
          images,
          testOpts,
        )
        setResult(testResult)
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      } else {
        if (!text.trim() || !textB.trim()) return
        const [resultA, resultB] = await Promise.all([
          testText(text, portraitsForTest, contentType, selectedZones, ollama, customSegments, images, testOpts),
          testText(textB, portraitsForTest, contentType, selectedZones, ollama, customSegments, images, testOpts),
        ])
        setCompare(compareResults(resultA, resultB))
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } finally {
      setLoading(false)
      setLoadingStep(null)
    }
  }

  const canTest =
    selectedSegments.length > 0 &&
    selectedZones.length > 0 &&
    (mode === 'single' ? text.trim().length > 10 : text.trim().length > 10 && textB.trim().length > 10)

  const testHint = useMemo(() => {
    if (canTest) return null
    if (selectedSegments.length === 0) return 'Выберите хотя бы один сегмент аудитории'
    if (selectedZones.length === 0) return 'Выберите хотя бы один город'
    if (mode === 'single' && text.trim().length <= 10) return 'Вставьте текст поста (минимум 11 символов)'
    if (mode === 'compare' && (text.trim().length <= 10 || textB.trim().length <= 10)) {
      return 'Заполните оба поста для сравнения'
    }
    return null
  }, [canTest, selectedSegments.length, selectedZones.length, mode, text, textB])

  return (
    <div className="min-h-screen bg-surface">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
            Проверьте <span className="gradient-text">пост</span> до публикации
          </h2>
          <p className="text-sm text-slate-400">
            Аудитория → текст поста → отклик персонажей → рекомендации и отчёт
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <AudiencePanel
              selectedSegments={selectedSegments}
              customSegments={customSegments}
              selectedZones={selectedZones}
              portraits={portraits}
              analysisSettings={analysisSettings}
              onAnalysisSettingsChange={handleAnalysisSettingsChange}
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
              onSelectGroup={selectGroup}
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
              loadingStep={loadingStep}
              portraitCount={selectPortraitsForAnalysis(portraits, analysisSettings.maxPortraitsForTest).length}
              canTest={canTest}
              testHint={testHint}
              sampleText={SAMPLE_TEXT}
              onModeChange={(m) => { setMode(m); clearResults() }}
              onTextChange={(t) => { setText(t); clearResults() }}
              onTextBChange={(t) => { setTextB(t); clearResults() }}
              onImagesAdd={(imgs) => { setImages((prev) => [...prev, ...imgs]); clearResults() }}
              onImageRemove={(id) => { setImages((prev) => prev.filter((i) => i.id !== id)); clearResults() }}
              onContentTypeChange={setContentType}
              onUseOllamaChange={setUseOllama}
              onTest={handleTest}
            />

            <div ref={resultsRef}>
              {compare && <CompareResults compare={compare} />}
              {result && !compare && (
                <TestResults result={result} reactionSettings={analysisSettings} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}