import type { NeuroPortrait } from '../types'

/**
 * Равномерная выборка портретов по сегментам при превышении лимита.
 * Старается взять хотя бы одного представителя каждого сегмента.
 */
export function selectPortraitsForAnalysis(
  pool: NeuroPortrait[],
  max: number | null,
): NeuroPortrait[] {
  if (!pool.length) return []
  if (max == null || pool.length <= max) return pool

  const bySegment = new Map<string, NeuroPortrait[]>()
  for (const p of pool) {
    const list = bySegment.get(p.segmentId) ?? []
    list.push(p)
    bySegment.set(p.segmentId, list)
  }

  const segments = [...bySegment.keys()]
  const selected: NeuroPortrait[] = []
  const indices = new Map<string, number>(segments.map((s) => [s, 0]))

  while (selected.length < max) {
    let added = false
    for (const seg of segments) {
      if (selected.length >= max) break
      const list = bySegment.get(seg)!
      const idx = indices.get(seg) ?? 0
      if (idx < list.length) {
        selected.push(list[idx])
        indices.set(seg, idx + 1)
        added = true
      }
    }
    if (!added) break
  }

  return selected
}