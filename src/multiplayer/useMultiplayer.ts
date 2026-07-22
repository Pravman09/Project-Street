import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { clearRemoteVehicleStates, getRemoteVehicleState, pushRemoteVehicleState, removeRemoteVehicleState } from './vehicleStore'
import type {
  ActionResult,
  ConnectionState,
  CreateRoomInput,
  JoinedRoomData,
  JoinRoomInput,
  MultiplayerSession,
  RaceProgress,
  RaceResult,
  RoomSettings,
  RoomSnapshot,
  VehicleNetworkState,
} from './types'

const SAVED_SESSION_KEY = 'project-street-multiplayer-session-v1'

interface SavedSession {
  roomCode: string
  playerId: string
  reconnectToken: string
}

export interface RemoteMapPlayer {
  id: string
  name: string
  color: string
  x: number
  z: number
}

function serverUrl() {
  const configured = import.meta.env.VITE_MULTIPLAYER_SERVER_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'http://localhost:3001'
  return ''
}

function readSavedSession(): SavedSession | null {
  try {
    const raw = window.sessionStorage.getItem(SAVED_SESSION_KEY)
    return raw ? JSON.parse(raw) as SavedSession : null
  } catch {
    return null
  }
}

export function useMultiplayer() {
  const socketRef = useRef<Socket | null>(null)
  const roomRef = useRef<RoomSnapshot | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('offline')
  const [room, setRoomState] = useState<RoomSnapshot | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [session, setSession] = useState<MultiplayerSession | null>(null)
  const [latency, setLatency] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [raceProgress, setRaceProgress] = useState<Record<string, RaceProgress>>({})
  const [raceResults, setRaceResults] = useState<RaceResult[]>([])
  const [remoteMapPlayers, setRemoteMapPlayers] = useState<RemoteMapPlayer[]>([])

  const setRoom = useCallback((next: RoomSnapshot | null) => {
    const previous = roomRef.current
    roomRef.current = next
    setRoomState(next)
    if (next) {
      const ids = new Set(next.players.map((player) => player.id))
      for (const existing of previous?.players ?? []) {
        if (!ids.has(existing.id)) removeRemoteVehicleState(existing.id)
      }
    }
  }, [])

  const clearSession = useCallback((message?: string) => {
    setRoom(null)
    setPlayerId(null)
    setSession(null)
    setRaceProgress({})
    setRaceResults([])
    setRemoteMapPlayers([])
    clearRemoteVehicleStates()
    try { window.sessionStorage.removeItem(SAVED_SESSION_KEY) } catch { /* Storage is optional. */ }
    if (message) setNotice(message)
  }, [setRoom])

  const acceptJoinedRoom = useCallback((joined: JoinedRoomData) => {
    setRoom(joined.room)
    setPlayerId(joined.playerId)
    setError(null)
    setNotice(null)
    try {
      window.sessionStorage.setItem(SAVED_SESSION_KEY, JSON.stringify({
        roomCode: joined.room.code,
        playerId: joined.playerId,
        reconnectToken: joined.reconnectToken,
      } satisfies SavedSession))
    } catch {
      // Reconnection remains optional when browser storage is blocked.
    }
  }, [setRoom])

  const configureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current
    const url = serverUrl()
    if (!url) {
      setConnection('error')
      setError('The multiplayer server is not configured for this deployment yet.')
      return null
    }
    const socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      timeout: 8000,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 700,
      reconnectionDelayMax: 3000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnection('online')
      setError(null)
      const saved = readSavedSession()
      if (!saved || roomRef.current) return
      socket.timeout(8000).emit('session:reconnect', saved, (timeoutError: Error | null, result: ActionResult<JoinedRoomData>) => {
        if (timeoutError || !result?.ok || !result.data) {
          try { window.sessionStorage.removeItem(SAVED_SESSION_KEY) } catch { /* ignored */ }
          if (result?.error) setNotice(result.error)
          return
        }
        acceptJoinedRoom(result.data)
      })
    })
    socket.on('disconnect', () => {
      setConnection(roomRef.current ? 'reconnecting' : 'offline')
      if (roomRef.current) setNotice('Connection lost. Reconnecting to the room…')
    })
    socket.on('connect_error', () => {
      setConnection('error')
      setError('The multiplayer server is unavailable. Check the server address and try again.')
    })
    socket.on('room:update', (next: RoomSnapshot) => {
      setRoom(next)
      setNotice(null)
    })
    socket.on('room:removed', (message: string) => clearSession(message))
    socket.on('room:closed', (message: string) => clearSession(message))
    socket.on('session:started', (next: MultiplayerSession) => {
      setSession(next)
      setRaceProgress({})
      setRaceResults([])
      setNotice(null)
    })
    socket.on('session:ended', (message: string) => {
      setSession(null)
      setRaceProgress({})
      setRaceResults([])
      clearRemoteVehicleStates()
      setNotice(message)
    })
    socket.on('vehicle:update', (state: VehicleNetworkState) => pushRemoteVehicleState(state))
    socket.on('race:progress', (progress: RaceProgress) => {
      setRaceProgress((current) => ({ ...current, [progress.playerId]: progress }))
    })
    socket.on('race:results', (results: RaceResult[]) => setRaceResults(results))
    return socket
  }, [acceptJoinedRoom, clearSession, setRoom])

  const ensureConnected = useCallback(async () => {
    const socket = configureSocket()
    if (!socket) return null
    if (socket.connected) return socket
    setConnection('connecting')
    return await new Promise<Socket | null>((resolve) => {
      const timer = window.setTimeout(() => {
        socket.off('connect', connected)
        setConnection('error')
        setError('The multiplayer server did not answer in time.')
        resolve(null)
      }, 9000)
      const connected = () => {
        window.clearTimeout(timer)
        resolve(socket)
      }
      socket.once('connect', connected)
      socket.connect()
    })
  }, [configureSocket])

  const request = useCallback(async <T,>(event: string, payload?: unknown): Promise<ActionResult<T>> => {
    const socket = await ensureConnected()
    if (!socket) return { ok: false, error: 'Multiplayer server unavailable.' }
    return await new Promise<ActionResult<T>>((resolve) => {
      const acknowledge = (timeoutError: Error | null, result: ActionResult<T>) => {
        if (timeoutError) return resolve({ ok: false, error: 'The multiplayer server did not answer.' })
        resolve(result ?? { ok: false, error: 'The multiplayer server returned an invalid response.' })
      }
      if (payload === undefined) socket.timeout(8000).emit(event, acknowledge)
      else socket.timeout(8000).emit(event, payload, acknowledge)
    })
  }, [ensureConnected])

  const createRoom = useCallback(async (input: CreateRoomInput) => {
    setError(null)
    const result = await request<JoinedRoomData>('room:create', input)
    if (result.ok && result.data) acceptJoinedRoom(result.data)
    else setError(result.error ?? 'Room creation failed.')
    return result.ok
  }, [acceptJoinedRoom, request])

  const joinRoom = useCallback(async (input: JoinRoomInput) => {
    setError(null)
    const result = await request<JoinedRoomData>('room:join', input)
    if (result.ok && result.data) acceptJoinedRoom(result.data)
    else setError(result.error ?? 'Could not join that room.')
    return result.ok
  }, [acceptJoinedRoom, request])

  const simpleAction = useCallback(async (event: string, payload?: unknown) => {
    setError(null)
    const result = await request(event, payload)
    if (!result.ok) setError(result.error ?? 'Multiplayer action failed.')
    return result.ok
  }, [request])

  const leaveRoom = useCallback(async () => {
    if (socketRef.current?.connected) await simpleAction('room:leave')
    clearSession()
  }, [clearSession, simpleAction])

  const closeRoom = useCallback(async () => {
    const closed = await simpleAction('room:close')
    if (closed) clearSession('Room closed.')
    return closed
  }, [clearSession, simpleAction])

  const sendVehicleState = useCallback((state: Omit<VehicleNetworkState, 'playerId' | 'timestamp'>) => {
    if (!socketRef.current?.connected || !session) return
    socketRef.current.volatile.emit('vehicle:update', { ...state, timestamp: performance.now() })
  }, [session])

  const authorizeRespawn = useCallback(() => {
    if (socketRef.current?.connected && session) socketRef.current.emit('vehicle:respawn')
  }, [session])

  useEffect(() => {
    if (connection !== 'online') return
    const timer = window.setInterval(() => {
      const socket = socketRef.current
      if (!socket?.connected) return
      const sentAt = performance.now()
      socket.timeout(3500).emit('latency:ping', sentAt, (timeoutError: Error | null) => {
        if (!timeoutError) setLatency(Math.max(1, Math.round(performance.now() - sentAt)))
      })
    }, 2500)
    return () => window.clearInterval(timer)
  }, [connection])

  useEffect(() => {
    if (!session || !room || !playerId) {
      setRemoteMapPlayers([])
      return
    }
    const sample = () => setRemoteMapPlayers(room.players.flatMap((player) => {
      if (player.id === playerId) return []
      const state = getRemoteVehicleState(player.id)
      return state ? [{ id: player.id, name: player.name, color: player.bodyColor, x: state.x, z: state.z }] : []
    }))
    sample()
    const timer = window.setInterval(sample, 250)
    return () => window.clearInterval(timer)
  }, [playerId, room, session])

  useEffect(() => () => {
    socketRef.current?.disconnect()
    clearRemoteVehicleStates()
  }, [])

  return {
    connection,
    room,
    playerId,
    session,
    latency,
    error,
    notice,
    raceProgress,
    raceResults,
    remoteMapPlayers,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    updateProfile: (vehicleId: string, bodyColor: string) => simpleAction('player:profile', { vehicleId, bodyColor }),
    setReady: (ready: boolean) => simpleAction('player:ready', { ready }),
    updateSettings: (settings: RoomSettings) => simpleAction('room:settings', settings),
    removePlayer: (targetPlayerId: string) => simpleAction('room:remove-player', { playerId: targetPlayerId }),
    startSession: (force = false) => simpleAction('session:start', { force }),
    returnToLobby: () => simpleAction('session:return-lobby'),
    sendVehicleState,
    authorizeRespawn,
    clearMessage: () => { setError(null); setNotice(null) },
  }
}

export type MultiplayerController = ReturnType<typeof useMultiplayer>
