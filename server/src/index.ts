import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { RoomStore } from './roomStore.js'
import {
  createRoomSchema,
  joinRoomSchema,
  playerIdSchema,
  playerProfileSchema,
  readySchema,
  reconnectSchema,
  roomSettingsSchema,
  startSchema,
  vehicleStateSchema,
} from './validation.js'
import { isVehicleAllowed } from './vehicles.js'
import type { ActionResult, InternalRoom, RoomSettings } from './types.js'

const port = Number(process.env.PORT || 3001)
const reconnectMs = Math.max(5, Math.min(60, Number(process.env.ROOM_RECONNECT_SECONDS || 20))) * 1000
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: allowedOrigins, methods: ['GET'] }))
app.use(express.json({ limit: '12kb' }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 24_000,
  pingInterval: 10_000,
  pingTimeout: 8_000,
})
const rooms = new RoomStore(reconnectMs)

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'project-street-multiplayer', rooms: rooms.rooms.size, uptimeSeconds: Math.floor(process.uptime()) })
})

app.get('/', (_request, response) => {
  response.json({ name: 'Project Street Multiplayer', status: 'online', health: '/health' })
})

interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>()

function rateAllowed(socketId: string, action: string, maximum: number, windowMs: number) {
  const key = `${socketId}:${action}`
  const now = Date.now()
  const current = rateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  current.count += 1
  return current.count <= maximum
}

function sessionPayload(room: InternalRoom) {
  const session = room.session
  if (!session) return null
  return {
    id: session.id,
    mode: session.mode,
    startedAt: session.startedAt,
    countdownEndsAt: session.countdownEndsAt,
    settings: { ...room.settings },
    spawns: { ...session.spawns },
  }
}

function roomUpdate(room: InternalRoom) {
  if (!rooms.rooms.has(room.code)) return
  io.to(room.code).emit('room:update', rooms.snapshot(room))
}

function raceState(room: InternalRoom) {
  for (const player of room.players.values()) {
    if (player.raceProgress) io.to(room.code).emit('race:progress', { ...player.raceProgress })
  }
  if (room.session?.results.length) io.to(room.code).emit('race:results', room.session.results.map((result) => ({ ...result })))
}

io.on('connection', (socket) => {
  socket.on('latency:ping', (sentAt: unknown, acknowledge?: (value: number) => void) => {
    if (typeof acknowledge === 'function') acknowledge(typeof sentAt === 'number' ? sentAt : Date.now())
  })

  socket.on('room:create', async (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    if (!rateAllowed(socket.id, 'create', 4, 60_000)) return acknowledge({ ok: false, error: 'Too many rooms created. Please wait a minute.' })
    const parsed = createRoomSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Check the room name, player name and settings.' })
    if (!isVehicleAllowed(parsed.data.vehicleId, parsed.data.settings.allowedCarClass)) return acknowledge({ ok: false, error: 'That vehicle is not allowed in this room.' })
    try {
      const previousRoomCode = rooms.roomForSocket(socket.id)?.room.code
      const { room, player } = await rooms.create(socket.id, parsed.data)
      if (previousRoomCode) await socket.leave(previousRoomCode)
      await socket.join(room.code)
      acknowledge({ ok: true, data: { room: rooms.snapshot(room), playerId: player.id, reconnectToken: player.reconnectToken } })
    } catch (error) {
      console.error('room:create failed', error)
      acknowledge({ ok: false, error: 'The room could not be created.' })
    }
  })

  socket.on('room:join', async (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    if (!rateAllowed(socket.id, 'join', 10, 60_000)) return acknowledge({ ok: false, error: 'Too many join attempts. Please wait a minute.' })
    const parsed = joinRoomSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Check the room code and player name.' })
    try {
      const previousRoomCode = rooms.roomForSocket(socket.id)?.room.code
      const result = await rooms.join(socket.id, parsed.data)
      if (!result.ok || !result.data) return acknowledge(result)
      if (!isVehicleAllowed(parsed.data.vehicleId, result.data.room.settings.allowedCarClass)) {
        rooms.leave(socket.id, true)
        return acknowledge({ ok: false, error: 'That vehicle class is not allowed in this room.' })
      }
      if (previousRoomCode) await socket.leave(previousRoomCode)
      await socket.join(result.data.room.code)
      acknowledge({ ok: true, data: { room: rooms.snapshot(result.data.room), playerId: result.data.player.id, reconnectToken: result.data.player.reconnectToken } })
      roomUpdate(result.data.room)
    } catch (error) {
      console.error('room:join failed', error)
      acknowledge({ ok: false, error: 'The room could not be joined.' })
    }
  })

  socket.on('session:reconnect', async (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    const parsed = reconnectSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Saved multiplayer session is invalid.' })
    const result = rooms.reconnect(socket.id, parsed.data.roomCode, parsed.data.playerId, parsed.data.reconnectToken)
    if (!result.ok || !result.data) return acknowledge(result)
    await socket.join(result.data.room.code)
    acknowledge({ ok: true, data: { room: rooms.snapshot(result.data.room), playerId: result.data.player.id, reconnectToken: result.data.player.reconnectToken } })
    roomUpdate(result.data.room)
    const session = sessionPayload(result.data.room)
    if (session) {
      socket.emit('session:started', session)
      raceState(result.data.room)
    }
  })

  socket.on('player:profile', (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    const parsed = playerProfileSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Invalid car selection.' })
    const context = rooms.roomForSocket(socket.id)
    if (!context || !isVehicleAllowed(parsed.data.vehicleId, context.room.settings.allowedCarClass)) return acknowledge({ ok: false, error: 'That vehicle is not allowed in this room.' })
    const result = rooms.updateProfile(socket.id, parsed.data.vehicleId, parsed.data.bodyColor)
    acknowledge(result.ok ? { ok: true } : result)
    if (result.ok && result.data) roomUpdate(result.data.room)
  })

  socket.on('player:ready', (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    const parsed = readySchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Invalid ready state.' })
    const result = rooms.setReady(socket.id, parsed.data.ready)
    acknowledge(result.ok ? { ok: true } : result)
    if (result.ok && result.data) roomUpdate(result.data.room)
  })

  socket.on('room:settings', (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    const parsed = roomSettingsSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'One or more room settings are invalid.' })
    const result = rooms.updateSettings(socket.id, parsed.data as RoomSettings)
    acknowledge(result.ok ? { ok: true } : result)
    if (result.ok && result.data) roomUpdate(result.data.room)
  })

  socket.on('room:remove-player', (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    const parsed = playerIdSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Invalid player.' })
    const context = rooms.roomForSocket(socket.id)
    const targetSocket = context?.room.players.get(parsed.data.playerId)?.socketId
    const result = rooms.removeByHost(socket.id, parsed.data.playerId)
    acknowledge(result.ok ? { ok: true } : result)
    if (!result.ok || !result.data) return
    if (targetSocket) {
      io.to(targetSocket).emit('room:removed', 'The host removed you from the room.')
      const target = io.sockets.sockets.get(targetSocket)
      if (target) void target.leave(result.data.room.code)
    }
    roomUpdate(result.data.room)
  })

  socket.on('room:leave', (acknowledge?: (result: ActionResult<unknown>) => void) => {
    const context = rooms.roomForSocket(socket.id)
    const code = context?.room.code
    const room = rooms.leave(socket.id, true)
    if (code) void socket.leave(code)
    if (typeof acknowledge === 'function') acknowledge({ ok: true })
    if (room) roomUpdate(room)
  })

  socket.on('room:close', (acknowledge: (result: ActionResult<unknown>) => void) => {
    const result = rooms.close(socket.id)
    if (!result.ok || !result.data) return acknowledge(result)
    io.to(result.data.room.code).emit('room:closed', 'The host closed this room.')
    for (const socketId of result.data.socketIds) {
      const client = io.sockets.sockets.get(socketId)
      if (client) void client.leave(result.data.room.code)
    }
    acknowledge({ ok: true })
  })

  socket.on('session:start', (raw: unknown, acknowledge: (result: ActionResult<unknown>) => void) => {
    const parsed = startSchema.safeParse(raw)
    if (!parsed.success) return acknowledge({ ok: false, error: 'Invalid start request.' })
    const result = rooms.start(socket.id, parsed.data.force)
    if (!result.ok || !result.data) return acknowledge(result)
    roomUpdate(result.data.room)
    const session = sessionPayload(result.data.room)
    if (session) io.to(result.data.room.code).emit('session:started', session)
    raceState(result.data.room)
    acknowledge({ ok: true })
  })

  socket.on('session:return-lobby', (acknowledge: (result: ActionResult<unknown>) => void) => {
    const result = rooms.returnToLobby(socket.id)
    if (!result.ok || !result.data) return acknowledge(result)
    io.to(result.data.room.code).emit('session:ended', 'The host returned everyone to the lobby.')
    roomUpdate(result.data.room)
    acknowledge({ ok: true })
  })

  socket.on('vehicle:respawn', (acknowledge?: (result: ActionResult<unknown>) => void) => {
    const result = rooms.authorizeRespawn(socket.id)
    if (typeof acknowledge === 'function') acknowledge(result.ok ? { ok: true, data: result.data?.spawn } : result)
  })

  socket.on('vehicle:update', (raw: unknown) => {
    if (!rateAllowed(socket.id, 'vehicle', 36, 1000)) return
    const parsed = vehicleStateSchema.safeParse(raw)
    if (!parsed.success) return
    const result = rooms.acceptVehicleState(socket.id, parsed.data)
    if (!result.ok || !result.data) return
    socket.to(result.data.room.code).volatile.emit('vehicle:update', result.data.state)
    if (result.data.raceChanged) {
      const player = result.data.room.players.get(result.data.state.playerId)
      if (player?.raceProgress) io.to(result.data.room.code).emit('race:progress', { ...player.raceProgress })
      if (result.data.room.session?.results.length) io.to(result.data.room.code).emit('race:results', result.data.room.session.results.map((entry) => ({ ...entry })))
    }
  })

  socket.on('disconnect', () => {
    rateBuckets.forEach((_value, key) => { if (key.startsWith(`${socket.id}:`)) rateBuckets.delete(key) })
    const disconnected = rooms.markDisconnected(socket.id)
    if (!disconnected) return
    roomUpdate(disconnected.room)
    setTimeout(() => {
      const room = rooms.expireDisconnected(disconnected.room.code, disconnected.player.id)
      if (room) roomUpdate(room)
    }, reconnectMs + 100)
  })
})

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Project Street multiplayer server listening on port ${port}`)
})

function shutdown(signal: string) {
  console.log(`${signal} received; closing multiplayer server`)
  io.close(() => httpServer.close(() => process.exit(0)))
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
