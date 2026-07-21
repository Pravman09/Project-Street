export type DynamicVehicleKind = 'traffic' | 'police' | 'rival'

export interface DynamicVehicleBody {
  id: string
  kind: DynamicVehicleKind
  x: number
  y: number
  z: number
  heading: number
  speed: number
  radius: number
}

const vehicles = new Map<string, DynamicVehicleBody>()

export function updateDynamicVehicle(vehicle: DynamicVehicleBody) {
  vehicles.set(vehicle.id, vehicle)
}

export function removeDynamicVehicle(id: string) {
  vehicles.delete(id)
}

export function getDynamicVehicles() {
  return vehicles.values()
}
