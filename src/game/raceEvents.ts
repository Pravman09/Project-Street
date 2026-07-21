export type RacePhase = 'free-roam' | 'countdown' | 'racing' | 'results'

export interface RacePoint {
  x: number
  z: number
}

export interface RaceEventDefinition {
  id: string
  name: string
  category: string
  color: string
  start: RacePoint
  checkpoints: RacePoint[]
  baseReward: number
  rivalTimes: number[]
  timeLimit: number
  requiredRep?: number
  boss?: boolean
}

export interface RaceOpponentDefinition {
  id: string
  name: string
  carId: string
  accent: string
}

export interface OpponentProgress {
  id: string
  progress: number
  finished: boolean
  finishMs: number
}

export interface RaceSession {
  phase: RacePhase
  eventId: string | null
  checkpointIndex: number
  countdown: number
  elapsedMs: number
  livePosition: number
  finishPosition: number
  reward: number
  didNotFinish: boolean
  repReward: number
  rivalDefeated: string | null
}

export const INITIAL_RACE_SESSION: RaceSession = {
  phase: 'free-roam',
  eventId: null,
  checkpointIndex: 0,
  countdown: 3,
  elapsedMs: 0,
  livePosition: 1,
  finishPosition: 0,
  reward: 0,
  didNotFinish: false,
  repReward: 0,
  rivalDefeated: null,
}

export const RACE_OPPONENTS: RaceOpponentDefinition[] = [
  { id: 'nova', name: 'NOVA', carId: 'aurelia-gt', accent: '#ffc84b' },
  { id: 'ryder', name: 'RYDER', carId: 'crimson-v12', accent: '#ff344c' },
  { id: 'kael', name: 'KAEL', carId: 'solaris-lm', accent: '#34bfff' },
]

export const RACE_EVENTS: RaceEventDefinition[] = [
  {
    id: 'downtown-loop',
    name: 'Downtown Loop',
    category: 'STREET CIRCUIT',
    color: '#35d9ff',
    start: { x: -40, z: -34 },
    checkpoints: [
      { x: -40, z: 10 },
      { x: 45, z: 10 },
      { x: 130, z: 10 },
      { x: 130, z: 92 },
      { x: 45, z: 92 },
      { x: -40, z: 92 },
      { x: -130, z: 92 },
      { x: -130, z: 10 },
      { x: -40, z: 10 },
    ],
    baseReward: 9000,
    rivalTimes: [36, 42, 49],
    timeLimit: 95,
  },
  {
    id: 'meridian-dash',
    name: 'Meridian Dash',
    category: 'HIGH-SPEED SPRINT',
    color: '#ffbf38',
    start: { x: -300, z: -223 },
    checkpoints: [
      { x: -242, z: -159 },
      { x: -174, z: -85 },
      { x: -106, z: -10 },
      { x: -38, z: 64 },
      { x: 30, z: 138 },
      { x: 98, z: 213 },
      { x: 150, z: 270 },
    ],
    baseReward: 14000,
    rivalTimes: [31, 36, 42],
    timeLimit: 90,
  },
  {
    id: 'metro-grand-tour',
    name: 'Metro Grand Tour',
    category: 'ENDURANCE CIRCUIT',
    color: '#ff456f',
    start: { x: 220, z: -145 },
    checkpoints: [
      { x: 130, z: -145 },
      { x: 45, z: -145 },
      { x: -40, z: -145 },
      { x: -130, z: -145 },
      { x: -210, z: -145 },
      { x: -210, z: -72 },
      { x: -210, z: 10 },
      { x: -210, z: 92 },
      { x: -130, z: 92 },
      { x: -40, z: 92 },
      { x: 45, z: 92 },
      { x: 130, z: 92 },
      { x: 220, z: 92 },
      { x: 220, z: 10 },
      { x: 220, z: -72 },
      { x: 220, z: -145 },
    ],
    baseReward: 22000,
    rivalTimes: [68, 78, 90],
    timeLimit: 150,
  },
  {
    id: 'ridge-rush',
    name: 'Ridge Rush',
    category: 'RIVAL MOUNTAIN SPRINT',
    color: '#32c7ff',
    start: { x: -900, z: 410 },
    checkpoints: [
      { x: -810, z: 560 }, { x: -660, z: 690 }, { x: -470, z: 760 },
      { x: -285, z: 690 }, { x: -180, z: 560 }, { x: -70, z: 420 }, { x: -40, z: 285 },
    ],
    baseReward: 30000,
    rivalTimes: [58, 67, 78],
    timeLimit: 125,
    requiredRep: 3400,
    boss: true,
  },
  {
    id: 'vex-showdown',
    name: 'Vex Showdown',
    category: 'BLACKLIST FINAL',
    color: '#c25cff',
    start: { x: 600, z: -570 },
    checkpoints: [
      { x: 690, z: -570 }, { x: 875, z: -350 }, { x: 900, z: 80 }, { x: 820, z: 480 },
      { x: 600, z: 700 }, { x: 160, z: 770 }, { x: -330, z: 750 }, { x: -690, z: 620 },
      { x: -880, z: 330 }, { x: -910, z: -120 }, { x: -790, z: -570 }, { x: -300, z: -665 },
      { x: 260, z: -660 }, { x: 600, z: -570 },
    ],
    baseReward: 50000,
    rivalTimes: [112, 126, 143],
    timeLimit: 205,
    requiredRep: 5400,
    boss: true,
  },
]

export const RACE_TRIGGER_RADIUS = 12
export const CHECKPOINT_RADIUS = 14

export const getRaceEvent = (eventId: string | null) => RACE_EVENTS.find((event) => event.id === eventId) ?? null

export function getRaceRoute(event: RaceEventDefinition) {
  const points = [event.start, ...event.checkpoints]
  const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.z - points[index].z))
  const cumulative: number[] = [0]
  segmentLengths.forEach((length) => cumulative.push(cumulative[cumulative.length - 1] + length))
  return { points, segmentLengths, cumulative, totalLength: cumulative[cumulative.length - 1] }
}

export function getPlayerRaceProgress(event: RaceEventDefinition, checkpointIndex: number, position: [number, number]) {
  const route = getRaceRoute(event)
  const segmentIndex = Math.min(checkpointIndex, route.segmentLengths.length - 1)
  const start = route.points[segmentIndex]
  const end = route.points[segmentIndex + 1]
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  const t = Math.max(0, Math.min(1, ((position[0] - start.x) * dx + (position[1] - start.z) * dz) / lengthSquared))
  const distance = route.cumulative[segmentIndex] + route.segmentLengths[segmentIndex] * t
  return Math.max(0, Math.min(1, distance / route.totalLength))
}

export function formatRaceTime(milliseconds: number) {
  const totalSeconds = Math.max(0, milliseconds) / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const hundredths = Math.floor((totalSeconds % 1) * 100)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}
