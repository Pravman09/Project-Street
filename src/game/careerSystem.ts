export interface CareerRival {
  id: string
  rank: number
  name: string
  crew: string
  eventId: string
  requiredRep: number
  rewardCarId: string | null
  accent: string
}

export const CAREER_RIVALS: CareerRival[] = [
  { id: 'dax', rank: 5, name: 'DAX', crew: 'OLD QUARTER', eventId: 'downtown-loop', requiredRep: 0, rewardCarId: null, accent: '#35d9ff' },
  { id: 'nova', rank: 4, name: 'NOVA', crew: 'MERIDIAN KINGS', eventId: 'meridian-dash', requiredRep: 800, rewardCarId: 'aurelia-gt', accent: '#ffc84b' },
  { id: 'ryder', rank: 3, name: 'RYDER', crew: 'REDLINE UNION', eventId: 'metro-grand-tour', requiredRep: 1900, rewardCarId: 'crimson-v12', accent: '#ff465f' },
  { id: 'kael', rank: 2, name: 'KAEL', crew: 'RIDGE RUNNERS', eventId: 'ridge-rush', requiredRep: 3400, rewardCarId: 'solaris-lm', accent: '#32c7ff' },
  { id: 'vex', rank: 1, name: 'VEX', crew: 'PORT MERIDIAN ELITE', eventId: 'vex-showdown', requiredRep: 5400, rewardCarId: 'phantom-r', accent: '#c25cff' },
]

export const getRivalForEvent = (eventId: string | null) => CAREER_RIVALS.find((rival) => rival.eventId === eventId) ?? null

export function getActiveRival(rep: number, defeatedRivalIds: string[]) {
  return CAREER_RIVALS.find((rival) => !defeatedRivalIds.includes(rival.id) && rep >= rival.requiredRep)
    ?? CAREER_RIVALS.find((rival) => !defeatedRivalIds.includes(rival.id))
    ?? null
}

export function isCareerEventUnlocked(eventId: string, rep: number, defeatedRivalIds: string[]) {
  const rival = getRivalForEvent(eventId)
  if (!rival) return true
  const previous = CAREER_RIVALS.find((candidate) => candidate.rank === rival.rank + 1)
  return rep >= rival.requiredRep && (!previous || defeatedRivalIds.includes(previous.id))
}

export function reputationForFinish(position: number, boss: boolean) {
  const base = [0, 620, 380, 220, 100][position] ?? 0
  return boss ? Math.round(base * 1.6) : base
}
