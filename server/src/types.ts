export type MultiplayerMode = 'free-roam' | 'race'
export type RoomStatus = 'lobby' | 'playing'

export interface RoomSettings {
  maxPlayers: number
  collisions: boolean
  traffic: boolean
  police: boolean
  timeOfDay: 'day' | 'sunset' | 'night' | 'dawn'
  allowedCarClass: string
  mode: MultiplayerMode
  raceRouteId: string
  laps: number
}

export interface PublicPlayer {
  id: string
  name: string
  vehicleId: string
  bodyColor: string
  ready: boolean
  host: boolean
  connected: boolean
}

export interface PublicRoom {
  code: string
  name: string
  hasPassword: boolean
  hostPlayerId: string
  players: PublicPlayer[]
  settings: RoomSettings
  status: RoomStatus
  createdAt: number
}

export interface VehicleState {
  playerId: string
  sequence: number
  x: number
  y: number
  z: number
  heading: number
  velocityX: number
  velocityZ: number
  steering: number
  speedKmh: number
  braking: boolean
  reverse: boolean
  gear: string
  nitroActive: boolean
  timestamp: number
}

export interface SpawnPoint {
  x: number
  y: number
  z: number
  heading: number
}

export interface RaceProgress {
  playerId: string
  checkpointIndex: number
  checkpointCount: number
  lap: number
  laps: number
  finished: boolean
  finishPosition: number
  elapsedMs: number
}

export interface RaceResult {
  playerId: string
  name: string
  vehicleId: string
  position: number
  elapsedMs: number
}

export interface InternalPlayer extends PublicPlayer {
  socketId: string | null
  reconnectToken: string
  reconnectUntil: number
  lastState: VehicleState | null
  lastStateAt: number
  allowTeleportUntil: number
  raceProgress: RaceProgress | null
}

export interface InternalSession {
  id: string
  mode: MultiplayerMode
  startedAt: number
  countdownEndsAt: number
  spawns: Record<string, SpawnPoint>
  results: RaceResult[]
}

export interface InternalRoom {
  code: string
  name: string
  hostPlayerId: string
  players: Map<string, InternalPlayer>
  passwordHash: string | null
  settings: RoomSettings
  status: RoomStatus
  createdAt: number
  session: InternalSession | null
}

export interface ActionResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}
