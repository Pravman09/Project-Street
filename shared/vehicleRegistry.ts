export type VehicleUnlockType = 'starter' | 'purchase' | 'mission' | 'premium' | 'legendary'
export type VehicleRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface CarPerformance {
  topSpeed: number
  acceleration: number
  handling: number
  grip?: number
  brakePower?: number
  nitroPower?: number
  nitroEfficiency?: number
}

export interface VehicleDefinition {
  id: string
  name: string
  modelPath: string
  category: string
  className: string
  rarity: VehicleRarity
  topSpeed: number
  acceleration: number
  handling: number
  braking: number
  unlockType: VehicleUnlockType
  unlockRequirement?: string
  price: number
  accent: string
  modelYOffset: number
  modelRotationY?: number
  performance: CarPerformance
}

export type CarDefinition = VehicleDefinition

export const CAR_CATALOG: VehicleDefinition[] = [
  {
    id: 'blackline-x', name: 'Blackline X', modelPath: '/models/player-car.glb',
    category: 'Street Build', className: 'Street Build', rarity: 'common',
    topSpeed: 52, acceleration: 22, handling: 0.9, braking: 0.82,
    unlockType: 'starter', price: 0, accent: '#ff3aa7', modelYOffset: 0.95,
    performance: { topSpeed: 52, acceleration: 22, handling: 0.9 },
  },
  {
    id: 'aurelia-gt', name: 'Aurelia GT', modelPath: '/models/aurelia-gt.glb',
    category: 'Supercar', className: 'Supercar', rarity: 'rare',
    topSpeed: 60, acceleration: 26, handling: 1, braking: 0.9,
    unlockType: 'purchase', unlockRequirement: '$18,000', price: 18000, accent: '#ffc84b', modelYOffset: 0.653,
    performance: { topSpeed: 60, acceleration: 26, handling: 1 },
  },
  {
    id: 'crimson-v12', name: 'Crimson V12', modelPath: '/models/crimson-v12.glb',
    category: 'Hypercar', className: 'Hypercar', rarity: 'epic',
    topSpeed: 63, acceleration: 28, handling: 0.96, braking: 0.92,
    unlockType: 'purchase', unlockRequirement: '$32,000', price: 32000, accent: '#ff344c', modelYOffset: 0.684,
    performance: { topSpeed: 63, acceleration: 28, handling: 0.96 },
  },
  {
    id: 'phantom-r', name: 'Phantom R', modelPath: '/models/phantom-r.glb',
    category: 'Track Special', className: 'Track Special', rarity: 'epic',
    topSpeed: 66, acceleration: 29, handling: 1.12, braking: 1.08,
    unlockType: 'mission', unlockRequirement: 'Defeat a ranked rival', price: 60000, accent: '#ff234f', modelYOffset: 0.572,
    performance: { topSpeed: 66, acceleration: 29, handling: 1.12 },
  },
  {
    id: 'midnight-classic', name: 'Midnight Classic', modelPath: '/models/midnight-classic.glb',
    category: 'Classic', className: 'Classic', rarity: 'common',
    topSpeed: 47, acceleration: 19, handling: 0.82, braking: 0.75,
    unlockType: 'starter', price: 0, accent: '#34a8ff', modelYOffset: 0.778,
    performance: { topSpeed: 47, acceleration: 19, handling: 0.82 },
  },
  {
    id: 'solaris-lm', name: 'Solaris LM', modelPath: '/models/solaris-lm.glb',
    category: 'Endurance', className: 'Endurance', rarity: 'epic',
    topSpeed: 68, acceleration: 29, handling: 1.06, braking: 1.02,
    unlockType: 'purchase', unlockRequirement: '$45,000', price: 45000, accent: '#ffd739', modelYOffset: 0.619,
    performance: { topSpeed: 68, acceleration: 29, handling: 1.06 },
  },
  {
    id: 'vesper-r', name: 'Vesper R', modelPath: '/models/vesper-r.glb',
    category: 'Track Supercar', className: 'Track Supercar', rarity: 'epic',
    topSpeed: 65, acceleration: 27, handling: 1.08, braking: 1.02,
    unlockType: 'purchase', unlockRequirement: '$42,000', price: 42000, accent: '#a969ff', modelYOffset: 0.569,
    performance: { topSpeed: 65, acceleration: 27, handling: 1.08 },
  },
  {
    id: 'apex-gt', name: 'Apex GT', modelPath: '/models/apex-gt.glb',
    category: 'GT Racer', className: 'GT Racer', rarity: 'epic',
    topSpeed: 67, acceleration: 28, handling: 1.15, braking: 1.08,
    unlockType: 'mission', unlockRequirement: 'Win the GT challenge', price: 55000, accent: '#ff7a32', modelYOffset: 0.617, modelRotationY: -Math.PI / 2,
    performance: { topSpeed: 67, acceleration: 28, handling: 1.15 },
  },
  {
    id: 'tempest-x', name: 'Tempest X', modelPath: '/models/tempest-x.glb',
    category: 'Prototype Hypercar', className: 'Prototype Hypercar', rarity: 'legendary',
    topSpeed: 72, acceleration: 31, handling: 1.09, braking: 1.1,
    unlockType: 'legendary', unlockRequirement: 'Defeat the Blacklist champion', price: 85000, accent: '#24f0c7', modelYOffset: 0.578,
    performance: { topSpeed: 72, acceleration: 31, handling: 1.09 },
  },
  {
    id: 'nightfall-rs', name: 'Nightfall RS', modelPath: '/models/nightfall-rs.glb',
    category: 'Tuned Coupe', className: 'Tuned Coupe', rarity: 'rare',
    topSpeed: 61, acceleration: 25, handling: 1.02, braking: 0.94,
    unlockType: 'purchase', unlockRequirement: '$28,000', price: 28000, accent: '#4a8dff', modelYOffset: 0.658,
    performance: { topSpeed: 61, acceleration: 25, handling: 1.02 },
  },
  {
    id: 'titan-xr', name: 'Titan XR', modelPath: '/models/titan-xr.glb',
    category: 'Performance SUV', className: 'Performance SUV', rarity: 'rare',
    topSpeed: 54, acceleration: 23, handling: 0.88, braking: 0.9,
    unlockType: 'purchase', unlockRequirement: '$35,000', price: 35000, accent: '#d9f04a', modelYOffset: 0.906,
    performance: { topSpeed: 54, acceleration: 23, handling: 0.88 },
  },
]

export const DEFAULT_CAR = CAR_CATALOG[0]!

export function isRegisteredVehicle(vehicleId: string) {
  return CAR_CATALOG.some((vehicle) => vehicle.id === vehicleId)
}

export function isVehicleInClass(vehicleId: string, allowedClass: string) {
  const vehicle = CAR_CATALOG.find((candidate) => candidate.id === vehicleId)
  return Boolean(vehicle && (allowedClass === 'any' || vehicle.className.toLowerCase() === allowedClass.toLowerCase()))
}

