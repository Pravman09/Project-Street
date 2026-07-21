export interface CarPerformance {
  topSpeed: number
  acceleration: number
  handling: number
  grip?: number
  brakePower?: number
  nitroPower?: number
  nitroEfficiency?: number
}

export interface CarDefinition {
  id: string
  name: string
  className: string
  modelPath: string
  modelYOffset: number
  modelRotationY?: number
  accent: string
  price: number
  performance: CarPerformance
}

export const CAR_CATALOG: CarDefinition[] = [
  {
    id: 'blackline-x',
    name: 'Blackline X',
    className: 'Street Build',
    modelPath: '/models/player-car.glb',
    modelYOffset: 0.95,
    accent: '#ff3aa7',
    price: 0,
    performance: { topSpeed: 52, acceleration: 22, handling: 0.9 },
  },
  {
    id: 'aurelia-gt',
    name: 'Aurelia GT',
    className: 'Supercar',
    modelPath: '/models/aurelia-gt.glb',
    modelYOffset: 0.653,
    accent: '#ffc84b',
    price: 18000,
    performance: { topSpeed: 60, acceleration: 26, handling: 1 },
  },
  {
    id: 'crimson-v12',
    name: 'Crimson V12',
    className: 'Hypercar',
    modelPath: '/models/crimson-v12.glb',
    modelYOffset: 0.684,
    accent: '#ff344c',
    price: 32000,
    performance: { topSpeed: 63, acceleration: 28, handling: 0.96 },
  },
  {
    id: 'phantom-r',
    name: 'Phantom R',
    className: 'Track Special',
    modelPath: '/models/phantom-r.glb',
    modelYOffset: 0.572,
    accent: '#ff234f',
    price: 60000,
    performance: { topSpeed: 66, acceleration: 29, handling: 1.12 },
  },
  {
    id: 'midnight-classic',
    name: 'Midnight Classic',
    className: 'Classic',
    modelPath: '/models/midnight-classic.glb',
    modelYOffset: 0.778,
    accent: '#34a8ff',
    price: 0,
    performance: { topSpeed: 47, acceleration: 19, handling: 0.82 },
  },
  {
    id: 'solaris-lm',
    name: 'Solaris LM',
    className: 'Endurance',
    modelPath: '/models/solaris-lm.glb',
    modelYOffset: 0.619,
    accent: '#ffd739',
    price: 45000,
    performance: { topSpeed: 68, acceleration: 29, handling: 1.06 },
  },
  {
    id: 'vesper-r',
    name: 'Vesper R',
    className: 'Track Supercar',
    modelPath: '/models/vesper-r.glb',
    modelYOffset: 0.569,
    accent: '#a969ff',
    price: 42000,
    performance: { topSpeed: 65, acceleration: 27, handling: 1.08 },
  },
  {
    id: 'apex-gt',
    name: 'Apex GT',
    className: 'GT Racer',
    modelPath: '/models/apex-gt.glb',
    modelYOffset: 0.617,
    modelRotationY: -Math.PI / 2,
    accent: '#ff7a32',
    price: 55000,
    performance: { topSpeed: 67, acceleration: 28, handling: 1.15 },
  },
  {
    id: 'tempest-x',
    name: 'Tempest X',
    className: 'Prototype Hypercar',
    modelPath: '/models/tempest-x.glb',
    modelYOffset: 0.578,
    accent: '#24f0c7',
    price: 85000,
    performance: { topSpeed: 72, acceleration: 31, handling: 1.09 },
  },
  {
    id: 'nightfall-rs',
    name: 'Nightfall RS',
    className: 'Tuned Coupe',
    modelPath: '/models/nightfall-rs.glb',
    modelYOffset: 0.658,
    accent: '#4a8dff',
    price: 28000,
    performance: { topSpeed: 61, acceleration: 25, handling: 1.02 },
  },
  {
    id: 'titan-xr',
    name: 'Titan XR',
    className: 'Performance SUV',
    modelPath: '/models/titan-xr.glb',
    modelYOffset: 0.906,
    accent: '#d9f04a',
    price: 35000,
    performance: { topSpeed: 54, acceleration: 23, handling: 0.88 },
  },
]

export const DEFAULT_CAR = CAR_CATALOG[0]
