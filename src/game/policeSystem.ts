export type PursuitPhase = 'patrol' | 'pursuit' | 'cooldown' | 'escaped' | 'busted'

export interface PursuitState {
  phase: PursuitPhase
  heat: number
  detection: number
  durationMs: number
  lostContactMs: number
  escapeProgress: number
  bustProgress: number
  outcomeCash: number
  outcomeId: number
  statusMs: number
}

export interface PoliceTelemetry {
  nearestDistance: number
  activeUnits: number
  unitPositions: Array<[number, number]>
}

export interface PoliceTacticTelemetry {
  spikeEventId: number
  breakerEventId: number
  inHidingSpot: boolean
  roadblockActive: boolean
}

export const INITIAL_PURSUIT_STATE: PursuitState = {
  phase: 'patrol',
  heat: 0,
  detection: 0,
  durationMs: 0,
  lostContactMs: 0,
  escapeProgress: 0,
  bustProgress: 0,
  outcomeCash: 0,
  outcomeId: 0,
  statusMs: 0,
}

export const INITIAL_POLICE_TELEMETRY: PoliceTelemetry = {
  nearestDistance: Number.POSITIVE_INFINITY,
  activeUnits: 0,
  unitPositions: [],
}

export const INITIAL_POLICE_TACTICS: PoliceTacticTelemetry = {
  spikeEventId: 0,
  breakerEventId: 0,
  inHidingSpot: false,
  roadblockActive: false,
}

export const SPEED_LIMIT_KMH = 125

export function formatPursuitTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
