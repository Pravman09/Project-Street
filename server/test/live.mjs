import { spawn } from 'node:child_process'
import { io } from 'socket.io-client'

const port = 3101
const server = spawn(process.execPath, ['dist/server/src/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: 'http://localhost:3000' },
  stdio: ['ignore', 'pipe', 'inherit'],
})

const waitForServer = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Server startup timed out.')), 8000)
  server.once('exit', (code) => reject(new Error(`Server exited before testing (${code}).`)))
  server.stdout.on('data', (chunk) => {
    if (!String(chunk).includes('listening on port')) return
    clearTimeout(timer)
    resolve()
  })
})

const connect = () => new Promise((resolve, reject) => {
  const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], timeout: 4000 })
  socket.once('connect', () => resolve(socket))
  socket.once('connect_error', reject)
})

const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve))
let host
let guest

try {
  await waitForServer
  const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json())
  if (!health.ok) throw new Error('Health endpoint failed.')
  ;[host, guest] = await Promise.all([connect(), connect()])
  const settings = {
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
  const created = await emit(host, 'room:create', { playerName: 'Host', roomName: 'Integration Crew', password: 'drive', vehicleId: 'blackline-x', bodyColor: '#ff3aa7', settings })
  if (!created.ok) throw new Error(created.error)
  const joined = await emit(guest, 'room:join', { playerName: 'Guest', roomCode: created.data.room.code, password: 'drive', vehicleId: 'midnight-classic', bodyColor: '#34a8ff' })
  if (!joined.ok) throw new Error(joined.error)
  await Promise.all([emit(host, 'player:ready', { ready: true }), emit(guest, 'player:ready', { ready: true })])
  const sessionSeen = new Promise((resolve) => guest.once('session:started', resolve))
  const started = await emit(host, 'session:start', { force: false })
  if (!started.ok) throw new Error(started.error)
  await sessionSeen
  const remoteSeen = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vehicle update timed out.')), 2500)
    guest.once('vehicle:update', (state) => { clearTimeout(timer); resolve(state) })
  })
  host.emit('vehicle:update', { sequence: 1, x: -46, y: 0.08, z: -72, heading: 0, velocityX: 0, velocityZ: 0, steering: 0, speedKmh: 0, braking: false, reverse: false, gear: 'N', nitroActive: false, timestamp: 0 })
  const remote = await remoteSeen
  if (remote.playerId !== created.data.playerId) throw new Error('Server did not preserve sender ownership.')
  console.log(`Two-client room, lobby, start and vehicle sync passed (${created.data.room.code}).`)
} finally {
  host?.disconnect()
  guest?.disconnect()
  server.kill('SIGTERM')
}
