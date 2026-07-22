import { z } from 'zod'

const safeText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum).regex(/^[\p{L}\p{N} _.'-]+$/u)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const roomSettingsSchema = z.object({
  maxPlayers: z.number().int().min(2).max(6),
  collisions: z.boolean(),
  traffic: z.boolean(),
  police: z.boolean(),
  timeOfDay: z.enum(['day', 'sunset', 'night', 'dawn']),
  allowedCarClass: z.string().trim().min(1).max(32),
  mode: z.enum(['free-roam', 'race']),
  raceRouteId: z.string().trim().min(1).max(48),
  laps: z.number().int().min(1).max(5),
})

export const createRoomSchema = z.object({
  playerName: safeText(1, 18),
  roomName: safeText(1, 28),
  password: z.string().max(48).optional().default(''),
  vehicleId: z.string().trim().min(1).max(48),
  bodyColor: color,
  settings: roomSettingsSchema,
})

export const joinRoomSchema = z.object({
  playerName: safeText(1, 18),
  roomCode: z.string().trim().toUpperCase().regex(/^PS-[A-Z2-9]{5}$/),
  password: z.string().max(48).optional().default(''),
  vehicleId: z.string().trim().min(1).max(48),
  bodyColor: color,
})

export const reconnectSchema = z.object({
  roomCode: z.string().trim().toUpperCase().regex(/^PS-[A-Z2-9]{5}$/),
  playerId: z.string().uuid(),
  reconnectToken: z.string().min(24).max(128),
})

export const playerProfileSchema = z.object({
  vehicleId: z.string().trim().min(1).max(48),
  bodyColor: color,
})

export const readySchema = z.object({ ready: z.boolean() })
export const playerIdSchema = z.object({ playerId: z.string().uuid() })
export const startSchema = z.object({ force: z.boolean().optional().default(false) })

export const vehicleStateSchema = z.object({
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  x: z.number().finite().min(-975).max(975),
  y: z.number().finite().min(-20).max(80),
  z: z.number().finite().min(-745).max(845),
  heading: z.number().finite().min(-100000).max(100000),
  velocityX: z.number().finite().min(-120).max(120),
  velocityZ: z.number().finite().min(-120).max(120),
  steering: z.number().finite().min(-1.2).max(1.2),
  speedKmh: z.number().finite().min(0).max(340),
  braking: z.boolean(),
  reverse: z.boolean(),
  gear: z.string().min(1).max(2),
  nitroActive: z.boolean(),
  timestamp: z.number().finite().nonnegative(),
})

