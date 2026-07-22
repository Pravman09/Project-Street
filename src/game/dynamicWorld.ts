export type WeatherState = 'clear' | 'overcast' | 'rain'

export function getWeatherForTime(minutes: number): WeatherState {
  const normalized = ((minutes % 1440) + 1440) % 1440
  if ((normalized >= 1110 && normalized < 1210) || (normalized >= 270 && normalized < 340)) return 'rain'
  if ((normalized >= 1060 && normalized < 1110) || (normalized >= 1210 && normalized < 1250) || (normalized >= 230 && normalized < 270) || (normalized >= 340 && normalized < 375)) return 'overcast'
  return 'clear'
}

export function formatWorldTime(minutes: number) {
  const normalized = ((Math.floor(minutes) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function isNightTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440
  return normalized < 360 || normalized >= 1140
}
