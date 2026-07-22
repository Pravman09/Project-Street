import { compare, hash } from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
import { CHECKPOINT_RADIUS, SERVER_RACE_ROUTES } from './races.js'
import type {
  ActionResult,
  InternalPlayer,
  InternalRoom,
  PublicRoom,
  RaceProgress,
  RoomSettings,
  SpawnPoint,
  VehicleState,
} from './types.js'
import { isVehicleAllowed } from './vehicles.js'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const FREE_ROAM_SPAWNS: SpawnPoint[] = [
  { x: -46, y: 0.08, z: -72, heading: 0 },
  { x: -42, y: 0.08, z: -72, heading: 0 },
  { x: -38, y: 0.08, z: -72, heading: 0 },
  { x: -34, y: 0.08, z: -72, heading: 0 },
  { x: -46, y: 0.08, z: -78, heading: 0 },
  { x: -38, y: 0.08, z: -78, heading: 0 },
]

const RACE_STARTS: Record<string, { x: number; z: number; heading: number }> = {
  'downtown-loop': { x: -40, z: -34, heading: 0 },
  'meridian-dash': { x: -300, z: -223, heading: 0.74 },
  'metro-grand-tour': { x: 220, z: -145, heading: -Math.PI / 2 },
}

function token() {
  return randomBytes(32).toString('base64url')
}

function publicPlayer(player: InternalPlayer) {
  const { id, name, vehicleId, bodyColor, ready, host, connected } = player
  return { id, name, vehicleId, bodyColor, ready, host, connected }
}

export class RoomStore {
  readonly rooms = new Map<string, InternalRoom>()
  private readonly socketPlayers = new Map<string, { roomCode: string; playerId: string }>()

  constructor(private readonly reconnectMs: number) {}

  roomForSocket(socketId: string) {
    const membership = this.socketPlayers.get(socketId)
    if (!membership) return null
    const room = this.rooms.get(membership.roomCode)
    const player = room?.players.get(membership.playerId)
    return room && player ? { room, player } : null
  }

  snapshot(room: InternalRoom): PublicRoom {
    return {
      code: room.code,
      name: room.name,
      hasPassword: room.passwordHash !== null,
      hostPlayerId: room.hostPlayerId,
      players: Array.from(room.players.values()).map(publicPlayer),
      settings: { ...room.settings },
      status: room.status,
      createdAt: room.createdAt,
    }
  }

  async create(socketId: string, input: { playerName: string; roomName: string; password: string; vehicleId: string; bodyColor: string; settings: RoomSettings }) {
    this.leave(socketId, true)
    const code = this.createCode()
    const player = this.createPlayer(socketId, input.playerName, input.vehicleId, input.bodyColor, true)
    const room: InternalRoom = {
      code,
      name: input.roomName,
      hostPlayerId: player.id,
      players: new Map([[player.id, player]]),
      passwordHash: input.password ? await hash(input.password, 10) : null,
      settings: { ...input.settings },
      status: 'lobby',
      createdAt: Date.now(),
      session: null,
    }
    this.rooms.set(code, room)
    this.socketPlayers.set(socketId, { roomCode: code, playerId: player.id })
    return { room, player }
  }

  async join(socketId: string, input: { playerName: string; roomCode: string; password: string; vehicleId: string; bodyColor: string }): Promise<ActionResult<{ room: InternalRoom; player: InternalPlayer }>> {
    const room = this.rooms.get(input.roomCode)
    if (!room) return { ok: false, error: 'Invalid room code.' }
    if (room.status !== 'lobby') return { ok: false, error: 'This session has already started.' }
    if (room.players.size >= room.settings.maxPlayers) return { ok: false, error: 'This room is full.' }
    if (room.passwordHash && !(await compare(input.password, room.passwordHash))) return { ok: false, error: 'Incorrect room password.' }
    if (Array.from(room.players.values()).some((player) => player.name.toLowerCase() === input.playerName.toLowerCase())) {
      return { ok: false, error: 'That player name is already used in this room.' }
    }
    this.leave(socketId, true)
    const player = this.createPlayer(socketId, input.playerName, input.vehicleId, input.bodyColor, false)
    room.players.set(player.id, player)
    this.socketPlayers.set(socketId, { roomCode: room.code, playerId: player.id })
    return { ok: true, data: { room, player } }
  }

  reconnect(socketId: string, roomCode: string, playerId: string, reconnectToken: string): ActionResult<{ room: InternalRoom; player: InternalPlayer }> {
    const room = this.rooms.get(roomCode)
    const player = room?.players.get(playerId)
    if (!room || !player || player.reconnectToken !== reconnectToken || player.reconnectUntil < Date.now()) {
      return { ok: false, error: 'Your previous multiplayer session has expired.' }
    }
    if (player.socketId) this.socketPlayers.delete(player.socketId)
    player.socketId = socketId
    player.connected = true
    player.reconnectUntil = 0
    this.socketPlayers.set(socketId, { roomCode, playerId })
    return { ok: true, data: { room, player } }
  }

  markDisconnected(socketId: string) {
    const membership = this.socketPlayers.get(socketId)
    if (!membership) return null
    this.socketPlayers.delete(socketId)
    const room = this.rooms.get(membership.roomCode)
    const player = room?.players.get(membership.playerId)
    if (!room || !player) return null
    player.socketId = null
    player.connected = false
    player.reconnectUntil = Date.now() + this.reconnectMs
    return { room, player }
  }

  expireDisconnected(roomCode: string, playerId: string) {
    const room = this.rooms.get(roomCode)
    const player = room?.players.get(playerId)
    if (!room || !player || player.connected || player.reconnectUntil > Date.now()) return null
    this.removePlayer(room, playerId)
    return room
  }

  leave(socketId: string, immediate = false) {
    const membership = this.socketPlayers.get(socketId)
    if (!membership) return null
    this.socketPlayers.delete(socketId)
    const room = this.rooms.get(membership.roomCode)
    if (!room) return null
    if (immediate) this.removePlayer(room, membership.playerId)
    return room
  }

  removeByHost(socketId: string, playerId: string): ActionResult<{ room: InternalRoom }> {
    const context = this.roomForSocket(socketId)
    if (!context || !context.player.host) return { ok: false, error: 'Only the host can remove players.' }
    if (playerId === context.player.id) return { ok: false, error: 'Use Leave Room to leave your own room.' }
    const target = context.room.players.get(playerId)
    if (!target) return { ok: false, error: 'Player not found.' }
    if (target.socketId) this.socketPlayers.delete(target.socketId)
    this.removePlayer(context.room, playerId)
    return { ok: true, data: { room: context.room } }
  }

  close(socketId: string): ActionResult<{ room: InternalRoom; socketIds: string[] }> {
    const context = this.roomForSocket(socketId)
    if (!context || !context.player.host) return { ok: false, error: 'Only the host can close the room.' }
    const socketIds = Array.from(context.room.players.values()).flatMap((player) => player.socketId ? [player.socketId] : [])
    for (const id of socketIds) this.socketPlayers.delete(id)
    this.rooms.delete(context.room.code)
    return { ok: true, data: { room: context.room, socketIds } }
  }

  updateProfile(socketId: string, vehicleId: string, bodyColor: string): ActionResult<{ room: InternalRoom }> {
    const context = this.roomForSocket(socketId)
    if (!context) return { ok: false, error: 'Join a room first.' }
    if (context.room.status !== 'lobby') return { ok: false, error: 'Cars can only be changed in the lobby.' }
    context.player.vehicleId = vehicleId
    context.player.bodyColor = bodyColor
    context.player.ready = false
    return { ok: true, data: { room: context.room } }
  }

  setReady(socketId: string, ready: boolean): ActionResult<{ room: InternalRoom }> {
    const context = this.roomForSocket(socketId)
    if (!context) return { ok: false, error: 'Join a room first.' }
    if (context.room.status !== 'lobby') return { ok: false, error: 'The session has already started.' }
    context.player.ready = ready
    return { ok: true, data: { room: context.room } }
  }

  updateSettings(socketId: string, settings: RoomSettings): ActionResult<{ room: InternalRoom }> {
    const context = this.roomForSocket(socketId)
    if (!context || !context.player.host) return { ok: false, error: 'Only the host can change room settings.' }
    if (context.room.status !== 'lobby') return { ok: false, error: 'Settings are locked during a session.' }
    if (settings.maxPlayers < context.room.players.size) return { ok: false, error: 'Maximum players cannot be below the current player count.' }
    if (settings.mode === 'race' && !SERVER_RACE_ROUTES[settings.raceRouteId]) return { ok: false, error: 'Unknown race route.' }
    if (Array.from(context.room.players.values()).some((player) => !isVehicleAllowed(player.vehicleId, settings.allowedCarClass))) {
      return { ok: false, error: 'A connected player is using a car outside that class.' }
    }
    context.room.settings = { ...settings }
    for (const player of context.room.players.values()) player.ready = false
    return { ok: true, data: { room: context.room } }
  }

  start(socketId: string, force: boolean): ActionResult<{ room: InternalRoom }> {
    const context = this.roomForSocket(socketId)
    if (!context || !context.player.host) return { ok: false, error: 'Only the host can start the session.' }
    const { room } = context
    if (room.status !== 'lobby') return { ok: false, error: 'The session is already running.' }
    const connected = Array.from(room.players.values()).filter((player) => player.connected)
    if (connected.length < 2) return { ok: false, error: 'At least two connected players are required.' }
    if (!force && connected.some((player) => !player.ready)) return { ok: false, error: 'Every connected player must be ready.' }

    const countdownEndsAt = Date.now() + (room.settings.mode === 'race' ? 5000 : 1800)
    const spawns = this.makeSpawns(room)
    room.session = {
      id: randomUUID(),
      mode: room.settings.mode,
      startedAt: countdownEndsAt,
      countdownEndsAt,
      spawns,
      results: [],
    }
    room.status = 'playing'
    for (const player of room.players.values()) {
      player.lastState = null
      player.lastStateAt = 0
      player.allowTeleportUntil = countdownEndsAt + 3000
      player.raceProgress = room.settings.mode === 'race' ? this.initialRaceProgress(room, player.id) : null
    }
    return { ok: true, data: { room } }
  }

  returnToLobby(socketId: string): ActionResult<{ room: InternalRoom }> {
    const context = this.roomForSocket(socketId)
    if (!context || !context.player.host) return { ok: false, error: 'Only the host can end the shared session.' }
    context.room.status = 'lobby'
    context.room.session = null
    for (const player of context.room.players.values()) {
      player.ready = false
      player.lastState = null
      player.raceProgress = null
    }
    return { ok: true, data: { room: context.room } }
  }

  authorizeRespawn(socketId: string): ActionResult<{ room: InternalRoom; spawn: SpawnPoint }> {
    const context = this.roomForSocket(socketId)
    if (!context || !context.room.session) return { ok: false, error: 'No multiplayer session is running.' }
    context.player.allowTeleportUntil = Date.now() + 2500
    const spawn = context.room.session.spawns[context.player.id]
    if (!spawn) return { ok: false, error: 'No safe respawn point is available.' }
    return { ok: true, data: { room: context.room, spawn } }
  }

  acceptVehicleState(socketId: string, state: Omit<VehicleState, 'playerId'>): ActionResult<{ room: InternalRoom; state: VehicleState; raceChanged: boolean }> {
    const context = this.roomForSocket(socketId)
    if (!context || context.room.status !== 'playing' || !context.room.session) return { ok: false, error: 'No multiplayer session is running.' }
    const now = Date.now()
    const previous = context.player.lastState
    if (previous && state.sequence <= previous.sequence) return { ok: false, error: 'Stale vehicle update.' }
    if (previous && now > context.player.allowTeleportUntil) {
      const elapsed = Math.max(0.016, (now - context.player.lastStateAt) / 1000)
      const distance = Math.hypot(state.x - previous.x, state.y - previous.y, state.z - previous.z)
      const allowedDistance = 10 + elapsed * 96
      if (distance > allowedDistance) return { ok: false, error: 'Vehicle movement was rejected.' }
    }
    const accepted: VehicleState = { ...state, playerId: context.player.id, timestamp: now }
    context.player.lastState = accepted
    context.player.lastStateAt = now
    const raceChanged = this.checkRaceProgress(context.room, context.player)
    return { ok: true, data: { room: context.room, state: accepted, raceChanged } }
  }

  private createPlayer(socketId: string, name: string, vehicleId: string, bodyColor: string, host: boolean): InternalPlayer {
    return {
      id: randomUUID(),
      name,
      vehicleId,
      bodyColor,
      ready: false,
      host,
      connected: true,
      socketId,
      reconnectToken: token(),
      reconnectUntil: 0,
      lastState: null,
      lastStateAt: 0,
      allowTeleportUntil: 0,
      raceProgress: null,
    }
  }

  private createCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let suffix = ''
      const bytes = randomBytes(5)
      for (const byte of bytes) suffix += ROOM_ALPHABET[byte! % ROOM_ALPHABET.length]
      const code = `PS-${suffix}`
      if (!this.rooms.has(code)) return code
    }
    throw new Error('Unable to allocate a room code.')
  }

  private removePlayer(room: InternalRoom, playerId: string) {
    room.players.delete(playerId)
    if (room.players.size === 0) {
      this.rooms.delete(room.code)
      return
    }
    if (room.hostPlayerId === playerId) {
      const nextHost = Array.from(room.players.values()).find((player) => player.connected) ?? room.players.values().next().value
      if (nextHost) {
        nextHost.host = true
        room.hostPlayerId = nextHost.id
      }
    }
  }

  private makeSpawns(room: InternalRoom) {
    const players = Array.from(room.players.values())
    const spawns: Record<string, SpawnPoint> = {}
    if (room.settings.mode === 'free-roam') {
      players.forEach((player, index) => { spawns[player.id] = { ...FREE_ROAM_SPAWNS[index % FREE_ROAM_SPAWNS.length]! } })
      return spawns
    }
    const start = RACE_STARTS[room.settings.raceRouteId] ?? RACE_STARTS['downtown-loop']!
    players.forEach((player, index) => {
      const row = Math.floor(index / 2)
      const side = index % 2 === 0 ? -1 : 1
      const lateralX = Math.cos(start.heading) * side * 2.2
      const lateralZ = -Math.sin(start.heading) * side * 2.2
      const backX = -Math.sin(start.heading) * row * 5
      const backZ = -Math.cos(start.heading) * row * 5
      spawns[player.id] = { x: start.x + lateralX + backX, y: 0.08, z: start.z + lateralZ + backZ, heading: start.heading }
    })
    return spawns
  }

  private initialRaceProgress(room: InternalRoom, playerId: string): RaceProgress {
    const route = SERVER_RACE_ROUTES[room.settings.raceRouteId] ?? SERVER_RACE_ROUTES['downtown-loop']!
    return {
      playerId,
      checkpointIndex: 0,
      checkpointCount: route.checkpoints.length,
      lap: 1,
      laps: room.settings.laps,
      finished: false,
      finishPosition: 0,
      elapsedMs: 0,
    }
  }

  private checkRaceProgress(room: InternalRoom, player: InternalPlayer) {
    const session = room.session
    const progress = player.raceProgress
    const state = player.lastState
    if (!session || session.mode !== 'race' || !progress || !state || progress.finished || Date.now() < session.countdownEndsAt) return false
    const route = SERVER_RACE_ROUTES[room.settings.raceRouteId]
    const checkpoint = route?.checkpoints[progress.checkpointIndex]
    if (!route || !checkpoint || Math.hypot(state.x - checkpoint.x, state.z - checkpoint.z) > CHECKPOINT_RADIUS) return false

    if (progress.checkpointIndex < route.checkpoints.length - 1) {
      progress.checkpointIndex += 1
      return true
    }
    if (progress.lap < progress.laps) {
      progress.lap += 1
      progress.checkpointIndex = 0
      return true
    }

    progress.finished = true
    progress.finishPosition = session.results.length + 1
    progress.elapsedMs = Math.max(0, Date.now() - session.startedAt)
    session.results.push({
      playerId: player.id,
      name: player.name,
      vehicleId: player.vehicleId,
      position: progress.finishPosition,
      elapsedMs: progress.elapsedMs,
    })
    return true
  }
}
