export type ConnectionState = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error'
export type MultiplayerMode = 'free-roam' | 'race'
export type RoomStatus = 'lobby' | 'playing'
export type TimeOfDay = 'day' | 'sunset' | 'night' | 'dawn'

export interface RoomSettings {
  maxPlayers: number
  collisions: boolean
  traffic: boolean
  police: boolean
  timeOfDay: TimeOfDay
  allowedCarClass: string
  mode: MultiplayerMode
  raceRouteId: string
  laps: number
}

export interface MultiplayerPlayer {
  id: string
  name: string
  vehicleId: string
  bodyColor: string
  ready: boolean
  host: boolean
  connected: boolean
}

export interface RoomSnapshot {
  code: string
  name: string
  hasPassword: boolean
  hostPlayerId: string
  players: MultiplayerPlayer[]
  settings: RoomSettings
  status: RoomStatus
  createdAt: number
}

export interface SpawnPoint {
  x: number
  y: number
  z: number
  heading: number
}

export interface MultiplayerSession {
  id: string
  mode: MultiplayerMode
  startedAt: number
  countdownEndsAt: number
  settings: RoomSettings
  spawns: Record<string, SpawnPoint>
}

export interface VehicleNetworkState {
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

export interface ActionResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}

export interface JoinedRoomData {
  room: RoomSnapshot
  playerId: string
  reconnectToken: string
}

export interface CreateRoomInput {
  playerName: string
  roomName: string
  password?: string
  vehicleId: string
  bodyColor: string
  settings: RoomSettings
}

export interface JoinRoomInput {
  playerName: string
  roomCode: string
  password?: string
  vehicleId: string
  bodyColor: string
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 6,
  collisions: false,
  traffic: true,
  police: false,
  timeOfDay: 'day',
  allowedCarClass: 'any',
  mode: 'free-roam',
  raceRouteId: 'downtown-loop',
  laps: 1,
}
