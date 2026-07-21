export type TrafficDensity = 'low' | 'medium' | 'high'
export type WeatherMode = 'dynamic' | 'clear' | 'rain'

export type DriveAction =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'handbrake'
  | 'nitro'
  | 'reset'
  | 'shiftUp'
  | 'shiftDown'

export type ControlBindings = Record<DriveAction, string>

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  forward: 'w',
  backward: 's',
  left: 'a',
  right: 'd',
  handbrake: ' ',
  nitro: 'shift',
  reset: 'r',
  shiftUp: 'x',
  shiftDown: 'z',
}

export const KEY_BINDING_OPTIONS = [
  { value: 'w', label: 'W' },
  { value: 'a', label: 'A' },
  { value: 's', label: 'S' },
  { value: 'd', label: 'D' },
  { value: 'arrowup', label: 'ARROW UP' },
  { value: 'arrowdown', label: 'ARROW DOWN' },
  { value: 'arrowleft', label: 'ARROW LEFT' },
  { value: 'arrowright', label: 'ARROW RIGHT' },
  { value: ' ', label: 'SPACE' },
  { value: 'shift', label: 'SHIFT' },
  { value: 'q', label: 'Q' },
  { value: 'e', label: 'E' },
  { value: 'r', label: 'R' },
  { value: 'z', label: 'Z' },
  { value: 'x', label: 'X' },
] as const

export interface ReleaseSettings {
  masterVolume: number
  engineVolume: number
  effectsVolume: number
  resolutionScale: number
  trafficDensity: TrafficDensity
  weatherMode: WeatherMode
  showFps: boolean
  controllerSensitivity: number
  controllerDeadzone: number
  bindings: ControlBindings
}

export const DEFAULT_RELEASE_SETTINGS: ReleaseSettings = {
  masterVolume: 0.82,
  engineVolume: 0.9,
  effectsVolume: 0.78,
  resolutionScale: 1,
  trafficDensity: 'medium',
  weatherMode: 'dynamic',
  showFps: false,
  controllerSensitivity: 1,
  controllerDeadzone: 0.14,
  bindings: { ...DEFAULT_CONTROL_BINDINGS },
}

export function isTrafficDensity(value: unknown): value is TrafficDensity {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function isWeatherMode(value: unknown): value is WeatherMode {
  return value === 'dynamic' || value === 'clear' || value === 'rain'
}

export function sanitizeBindings(value: unknown): ControlBindings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CONTROL_BINDINGS }
  const source = value as Partial<ControlBindings>
  return Object.fromEntries(
    Object.entries(DEFAULT_CONTROL_BINDINGS).map(([action, fallback]) => [
      action,
      typeof source[action as DriveAction] === 'string' ? source[action as DriveAction] : fallback,
    ]),
  ) as ControlBindings
}
