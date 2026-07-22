import type { VehicleNetworkState } from './types'

type Listener = (state: VehicleNetworkState) => void

const states = new Map<string, VehicleNetworkState>()
const listeners = new Map<string, Set<Listener>>()

export function pushRemoteVehicleState(state: VehicleNetworkState) {
  states.set(state.playerId, state)
  listeners.get(state.playerId)?.forEach((listener) => listener(state))
}

export function subscribeToRemoteVehicle(playerId: string, listener: Listener) {
  const playerListeners = listeners.get(playerId) ?? new Set<Listener>()
  playerListeners.add(listener)
  listeners.set(playerId, playerListeners)
  const current = states.get(playerId)
  if (current) listener(current)
  return () => {
    playerListeners.delete(listener)
    if (playerListeners.size === 0) listeners.delete(playerId)
  }
}

export function getRemoteVehicleState(playerId: string) {
  return states.get(playerId) ?? null
}

export function removeRemoteVehicleState(playerId: string) {
  states.delete(playerId)
}

export function clearRemoteVehicleStates() {
  states.clear()
}

