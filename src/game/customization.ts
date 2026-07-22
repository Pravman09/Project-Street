export type PaintFinish = 'gloss' | 'metallic' | 'satin'
export type WheelStyle = 'stock' | 'sport' | 'mesh'
export type RideHeight = 'stock' | 'street' | 'low'
export type WindowTint = 'light' | 'smoke' | 'black'

export interface CarCustomization {
  paint: string
  finish: PaintFinish
  wheelStyle: WheelStyle
  rimColor: string
  underglow: string
  rideHeight: RideHeight
  tint: WindowTint
}

export type CustomizationGarage = Record<string, CarCustomization>

export const DEFAULT_CUSTOMIZATION: CarCustomization = {
  paint: 'factory',
  finish: 'gloss',
  wheelStyle: 'stock',
  rimColor: '#d8dee4',
  underglow: 'off',
  rideHeight: 'stock',
  tint: 'light',
}

export const PAINT_PRESETS = [
  { name: 'Factory', value: 'factory' },
  { name: 'Arctic', value: '#e8edf1' },
  { name: 'Onyx', value: '#11151c' },
  { name: 'Rosso', value: '#d91f2a' },
  { name: 'Cobalt', value: '#135ed8' },
  { name: 'Solar', value: '#f1bd21' },
  { name: 'Emerald', value: '#087e60' },
  { name: 'Violet', value: '#7137c8' },
] as const

export const RIM_COLORS = ['#d8dee4', '#15191e', '#aeb4ba', '#c89b3c', '#c63c3c', '#3a7ee8'] as const
export const UNDERGLOW_PRESETS = [
  { name: 'Off', value: 'off' },
  { name: 'Ice', value: '#38e7ff' },
  { name: 'Violet', value: '#a969ff' },
  { name: 'Red', value: '#ff344c' },
  { name: 'Lime', value: '#76ff68' },
] as const

export function getCarCustomization(garage: CustomizationGarage, carId: string): CarCustomization {
  return { ...DEFAULT_CUSTOMIZATION, ...(garage[carId] ?? {}) }
}

export function isCustomizationGarage(value: unknown): value is CustomizationGarage {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function getRideHeightOffset(rideHeight: RideHeight) {
  if (rideHeight === 'low') return -0.16
  if (rideHeight === 'street') return -0.08
  return 0
}
