import { useState } from 'react'
import type { AudienceSegment } from '../types'
import { createCustomSegment } from '../utils/segment-registry'

interface CustomSegmentFormProps {
  onAdd: (segment: AudienceSegment) => void
}

export function CustomSegmentForm({ onAdd }: CustomSegmentFormProps) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [description, setDescription] = useState('')
  const [values, setValues] = useState('')
  const [painPoints, setPainPoints] = useState('')
  const [languageExpectations, setLanguageExpectations] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    const segment = createCustomSegment({
      label,
      ageRange,
      description,
      values,
      painPoints,
      languageExpectations,
    })
    onAdd(segment)
    setLabel('')
    setAgeRange('')
    setDescription('')
    setValues('')
    setPainPoints('')
    setLanguageExpectations('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-2 py-2 rounded-lg border border-dashed border-indigo-500/30 text-xs text-indigo-300 hover:bg-indigo-500/5"
      >
        + Свой сегмент аудитории
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 rounded-xl bg-surface-3 border border-indigo-500/20 space-y-2">
      <p className="text-xs text-slate-400 mb-2">Свой сегмент под ваш проект</p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Название: волонтёры, предприниматели…"
        required
        className="w-full px-3 py-2 rounded-lg bg-surface text-white text-xs border border-border focus:border-indigo-500 focus:outline-none"
      />
      <input
        value={ageRange}
        onChange={(e) => setAgeRange(e.target.value)}
        placeholder="Возраст: 25–40"
        className="w-full px-3 py-2 rounded-lg bg-surface text-white text-xs border border-border focus:border-indigo-500 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Кто это, чем живут, где в Удмуртии"
        rows={2}
        className="w-full px-3 py-2 rounded-lg bg-surface text-white text-xs border border-border focus:border-indigo-500 focus:outline-none resize-none"
      />
      <input
        value={painPoints}
        onChange={(e) => setPainPoints(e.target.value)}
        placeholder="Боли через запятую"
        className="w-full px-3 py-2 rounded-lg bg-surface text-white text-xs border border-border focus:border-indigo-500 focus:outline-none"
      />
      <input
        value={languageExpectations}
        onChange={(e) => setLanguageExpectations(e.target.value)}
        placeholder="Ожидания к языку через запятую"
        className="w-full px-3 py-2 rounded-lg bg-surface text-white text-xs border border-border focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex gap-2 pt-1">
        <button type="submit" className="flex-1 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 text-xs font-medium">
          Добавить
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-slate-500">
          Отмена
        </button>
      </div>
    </form>
  )
}