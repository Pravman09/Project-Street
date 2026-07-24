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
  {
    id: 'dodge-challenger-srt', name: 'Dodge Challenger SRT', modelPath: '/models/dodge-challenger-srt.glb',
    category: 'American Muscle', className: 'Muscle', rarity: 'rare',
    topSpeed: 62, acceleration: 26, handling: 0.86, braking: 0.91,
    unlockType: 'purchase', unlockRequirement: '$42,000', price: 42000, accent: '#249de0', modelYOffset: 0.709,
    performance: { topSpeed: 62, acceleration: 26, handling: 0.86, grip: 0.92, brakePower: 0.91, nitroPower: 1.08 },
  },
  {
    id: 'nissan-skyline-r34', name: 'Nissan Skyline GT-R R34', modelPath: '/models/nissan-skyline-r34.glb',
    category: 'JDM Icon', className: 'Tuner', rarity: 'epic',
    topSpeed: 64, acceleration: 28, handling: 1.08, braking: 0.98,
    unlockType: 'purchase', unlockRequirement: '$48,000', price: 48000, accent: '#f3f5f4', modelYOffset: 0.706,
    performance: { topSpeed: 64, acceleration: 28, handling: 1.08, grip: 1.08, brakePower: 0.98, nitroEfficiency: 1.06 },
  },
  {
    id: 'mercedes-amg-gt', name: 'Mercedes-AMG GT', modelPath: '/models/mercedes-amg-gt.glb',
    category: 'Grand Tourer', className: 'GT', rarity: 'epic',
    topSpeed: 68, acceleration: 30, handling: 1.1, braking: 1.04,
    unlockType: 'purchase', unlockRequirement: '$65,000', price: 65000, accent: '#39d11f', modelYOffset: 0.712,
    performance: { topSpeed: 68, acceleration: 30, handling: 1.1, grip: 1.06, brakePower: 1.04, nitroPower: 1.1 },
  },
  {
    id: 'ferrari-race-edition', name: 'Ferrari Race Edition', modelPath: '/models/ferrari-race-edition.glb',
    category: 'Factory Race Car', className: 'Track', rarity: 'legendary',
    topSpeed: 75, acceleration: 34, handling: 1.24, braking: 1.16,
    unlockType: 'legendary', unlockRequirement: 'Win the Port Meridian Grand Final', price: 115000, accent: '#ffd21f', modelYOffset: 0.624,
    performance: { topSpeed: 75, acceleration: 34, handling: 1.24, grip: 1.2, brakePower: 1.16, nitroPower: 1.14, nitroEfficiency: 1.1 },
  },
  {
    id: 'rolls-royce-wraith', name: 'Rolls-Royce Wraith', modelPath: '/models/rolls-royce-wraith.glb',
    category: 'Luxury Coupe', className: 'Luxury', rarity: 'legendary',
    topSpeed: 57, acceleration: 23, handling: 0.82, braking: 0.94,
    unlockType: 'premium', unlockRequirement: '$95,000', price: 95000, accent: '#7dcbe3', modelYOffset: 0.726,
    performance: { topSpeed: 57, acceleration: 23, handling: 0.82, grip: 0.9, brakePower: 0.94, nitroEfficiency: 1.08 },
  },
   {
  id: 'lamborghini-sian',
  name: 'Lamborghini Sian',
  modelPath: '/models/LamborghiniSian.glb',

  category: 'Italian Hypercar',
  className: 'Hypercar',
  rarity: 'legendary',

  topSpeed: 89,
  acceleration: 41,
  handling: 0.97,
  braking: 0.98,

  unlockType: 'purchase',
  unlockRequirement: '$1000',
  price: 1000,

  accent: '#7AFF00',
  modelYOffset: 0.20,

  performance: {
    topSpeed: 89,
    acceleration: 41,
    handling: 0.97,
    grip: 0.98,
    brakePower: 0.98,
    nitroPower: 1.20
  },
},
{
  id: 'lamborghini-svj',
  name: 'Lamborghini Aventador SVJ',
  modelPath: '/models/LamborghiniSVJ63.glb',

  category: 'Italian Supercar',
  className: 'Hypercar',
  rarity: 'epic',

  topSpeed: 84,
  acceleration: 39,
  handling: 0.95,
  braking: 0.97,

  unlockType: 'purchase',
  unlockRequirement: '$1,000',
  price: 1000,

  accent: '#A6FF00',
  modelYOffset: 0.20,

  performance: {
    topSpeed: 84,
    acceleration: 39,
    handling: 0.95,
    grip: 0.97,
    brakePower: 0.97,
    nitroPower: 1.16
  },
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
