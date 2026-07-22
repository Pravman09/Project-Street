import type { CarPerformance } from './carCatalog'

export type UpgradePart = 'engine' | 'transmission' | 'handling' | 'brakes' | 'nitrous'
export type CarUpgrades = Record<UpgradePart, number>
export type UpgradeGarage = Record<string, CarUpgrades>

export const UPGRADE_PARTS: Array<{ id: UpgradePart; name: string; description: string; baseCost: number }> = [
  { id: 'engine', name: 'Engine', description: 'Acceleration and top speed', baseCost: 4500 },
  { id: 'transmission', name: 'Transmission', description: 'Power delivery and gearing', baseCost: 3800 },
  { id: 'handling', name: 'Chassis', description: 'Grip and steering response', baseCost: 3400 },
  { id: 'brakes', name: 'Brakes', description: 'Shorter, more stable braking', baseCost: 2600 },
  { id: 'nitrous', name: 'Nitrous', description: 'Stronger and longer boost', baseCost: 4200 },
]

export const EMPTY_UPGRADES: CarUpgrades = { engine: 0, transmission: 0, handling: 0, brakes: 0, nitrous: 0 }
export const getCarUpgrades = (garage: UpgradeGarage, carId: string): CarUpgrades => {
  const saved = garage[carId] ?? EMPTY_UPGRADES
  return Object.fromEntries(Object.keys(EMPTY_UPGRADES).map((part) => {
    const value = saved[part as UpgradePart]
    return [part, Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0]
  })) as CarUpgrades
}

export function getUpgradeCost(part: UpgradePart, currentLevel: number) {
  const definition = UPGRADE_PARTS.find((candidate) => candidate.id === part)!
  return Math.round(definition.baseCost * (1 + currentLevel * 0.72))
}

export function applyUpgrades(base: CarPerformance, upgrades: CarUpgrades): CarPerformance {
  return {
    topSpeed: base.topSpeed * (1 + upgrades.engine * 0.028 + upgrades.transmission * 0.018),
    acceleration: base.acceleration * (1 + upgrades.engine * 0.07 + upgrades.transmission * 0.035),
    handling: base.handling * (1 + upgrades.handling * 0.055),
    grip: (base.grip ?? 1) * (1 + upgrades.handling * 0.07),
    brakePower: (base.brakePower ?? 1) * (1 + upgrades.brakes * 0.12),
    nitroPower: (base.nitroPower ?? 1) * (1 + upgrades.nitrous * 0.11),
    nitroEfficiency: (base.nitroEfficiency ?? 1) * (1 + upgrades.nitrous * 0.13),
  }
}
