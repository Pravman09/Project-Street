export type DestructibleKind = 'cone' | 'sign' | 'fence'

export interface DestructibleObject {
  id: string
  kind: DestructibleKind
  x: number
  y: number
  z: number
  radius: number
  minBreakSpeed: number
  brokenAt: number
  impulseX: number
  impulseZ: number
}

const objects = new Map<string, DestructibleObject>()

export function registerDestructible(object: Omit<DestructibleObject, 'brokenAt' | 'impulseX' | 'impulseZ'>) {
  const existing = objects.get(object.id)
  objects.set(object.id, existing ? { ...existing, ...object } : { ...object, brokenAt: 0, impulseX: 0, impulseZ: 0 })
}

export function removeDestructible(id: string) {
  objects.delete(id)
}

export function getDestructibles() {
  return objects.values()
}

export function getDestructible(id: string) {
  return objects.get(id)
}

export function breakDestructible(id: string, impulseX: number, impulseZ: number) {
  const object = objects.get(id)
  if (!object || object.brokenAt > 0) return false
  object.brokenAt = performance.now()
  object.impulseX = impulseX
  object.impulseZ = impulseZ
  return true
}

export function resetDestructibles() {
  for (const object of objects.values()) {
    object.brokenAt = 0
    object.impulseX = 0
    object.impulseZ = 0
  }
}
