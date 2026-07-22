import assert from 'node:assert/strict'
import test from 'node:test'
import { RoomStore } from '../src/roomStore.js'
import type { RoomSettings } from '../src/types.js'
import { SERVER_RACE_ROUTES } from '../src/races.js'

const settings: RoomSettings = {
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

test('creates, joins, readies and starts a private room', async () => {
  const store = new RoomStore(20_000)
  const host = await store.create('socket-host', { playerName: 'Host', roomName: 'Night Crew', password: 'secret', vehicleId: 'blackline-x', bodyColor: '#ff3aa7', settings })
  const badPassword = await store.join('socket-bad', { playerName: 'Bad', roomCode: host.room.code, password: 'wrong', vehicleId: 'blackline-x', bodyColor: '#ffffff' })
  assert.equal(badPassword.ok, false)
  const guest = await store.join('socket-guest', { playerName: 'Guest', roomCode: host.room.code, password: 'secret', vehicleId: 'aurelia-gt', bodyColor: '#ffc84b' })
  assert.equal(guest.ok, true)
  assert.equal(store.start('socket-host', false).ok, false)
  store.setReady('socket-host', true)
  store.setReady('socket-guest', true)
  const started = store.start('socket-host', false)
  assert.equal(started.ok, true)
  assert.equal(started.data?.room.session?.mode, 'free-roam')
})

test('transfers host and deletes an empty room', async () => {
  const store = new RoomStore(20_000)
  const host = await store.create('socket-one', { playerName: 'One', roomName: 'Crew', password: '', vehicleId: 'blackline-x', bodyColor: '#ff3aa7', settings })
  const guest = await store.join('socket-two', { playerName: 'Two', roomCode: host.room.code, password: '', vehicleId: 'aurelia-gt', bodyColor: '#ffc84b' })
  assert.equal(guest.ok, true)
  store.leave('socket-one', true)
  assert.equal(host.room.hostPlayerId, guest.data?.player.id)
  assert.equal(guest.data?.player.host, true)
  store.leave('socket-two', true)
  assert.equal(store.rooms.size, 0)
})

test('accepts race checkpoints only in order and produces an authoritative result', async () => {
  const store = new RoomStore(20_000)
  const raceSettings: RoomSettings = { ...settings, mode: 'race', raceRouteId: 'downtown-loop', laps: 1 }
  const host = await store.create('race-host', { playerName: 'Host', roomName: 'Race', password: '', vehicleId: 'blackline-x', bodyColor: '#ff3aa7', settings: raceSettings })
  await store.join('race-guest', { playerName: 'Guest', roomCode: host.room.code, password: '', vehicleId: 'aurelia-gt', bodyColor: '#ffc84b' })
  store.setReady('race-host', true)
  store.setReady('race-guest', true)
  assert.equal(store.start('race-host', false).ok, true)
  host.room.session!.countdownEndsAt = Date.now() - 100
  host.room.session!.startedAt = Date.now() - 100
  host.player.allowTeleportUntil = Date.now() + 60_000
  const route = SERVER_RACE_ROUTES['downtown-loop']!
  let sequence = 1
  const send = (x: number, z: number) => store.acceptVehicleState('race-host', {
    sequence: sequence++, x, y: 0.08, z, heading: 0, velocityX: 0, velocityZ: 0,
    steering: 0, speedKmh: 0, braking: false, reverse: false, gear: 'N', nitroActive: false, timestamp: 0,
  })
  const skipped = route.checkpoints[4]!
  send(skipped.x, skipped.z)
  assert.equal(host.player.raceProgress?.checkpointIndex, 0)
  for (const checkpoint of route.checkpoints) send(checkpoint.x, checkpoint.z)
  assert.equal(host.player.raceProgress?.finished, true)
  assert.equal(host.player.raceProgress?.finishPosition, 1)
  assert.equal(host.room.session?.results[0]?.playerId, host.player.id)
})
