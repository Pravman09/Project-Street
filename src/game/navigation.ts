export interface NavigationTarget {
  id: string
  name: string
  category: 'event' | 'garage' | 'landmark'
  x: number
  z: number
  color: string
}

export const NAV_LOCATIONS: NavigationTarget[] = [
  { id: 'safehouse', name: 'Downtown Garage', category: 'garage', x: -40, z: -72, color: '#45efff' },
  { id: 'airport', name: 'Meridian Airfield', category: 'landmark', x: 650, z: -500, color: '#ffd35a' },
  { id: 'stadium', name: 'Meridian Stadium', category: 'landmark', x: 175, z: 131, color: '#ff687f' },
  { id: 'marina', name: 'Bayfront Marina', category: 'landmark', x: 850, z: 150, color: '#55d9ff' },
  { id: 'observatory', name: 'Ridge Observatory', category: 'landmark', x: -610, z: 600, color: '#bd8cff' },
  { id: 'ridge-manor', name: 'Granite Ridge Estates', category: 'landmark', x: -38, z: 575, color: '#9fc47a' },
  { id: 'southworks', name: 'Southworks Depot', category: 'landmark', x: -640, z: -500, color: '#ff9c4a' },
]
