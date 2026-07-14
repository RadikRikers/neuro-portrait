import type { PersonaReaction } from '../types'
import type { ReactionFilter, ReactionSort } from './analysis-settings'

export function filterReactions(
  reactions: PersonaReaction[],
  filter: ReactionFilter,
): PersonaReaction[] {
  if (filter === 'all') return reactions
  return reactions.filter((r) => r.sentiment === filter)
}

export function sortReactions(
  reactions: PersonaReaction[],
  sort: ReactionSort,
): PersonaReaction[] {
  const copy = [...reactions]
  if (sort === 'score_desc') {
    return copy.sort((a, b) => b.overallScore - a.overallScore)
  }
  if (sort === 'segment') {
    return copy.sort((a, b) =>
      a.segmentLabel.localeCompare(b.segmentLabel, 'ru') || b.overallScore - a.overallScore,
    )
  }
  const order = { negative: 0, neutral: 1, positive: 2 }
  return copy.sort((a, b) =>
    (order[a.sentiment] - order[b.sentiment]) || b.overallScore - a.overallScore,
  )
}

export function applyReactionView(
  reactions: PersonaReaction[],
  sort: ReactionSort,
  filter: ReactionFilter,
): PersonaReaction[] {
  return sortReactions(filterReactions(reactions, filter), sort)
}