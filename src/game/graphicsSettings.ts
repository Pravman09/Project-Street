export type GraphicsQuality = 'low' | 'medium' | 'high'

export interface GraphicsProfile {
  label: string
  dpr: [number, number]
  shadows: boolean
  shadowSize: number
  drawDistance: number
  roadWear: number
  lightSpacing: number
}

export const GRAPHICS_PROFILES: Record<GraphicsQuality, GraphicsProfile> = {
  low: {
    label: 'PERFORMANCE',
    dpr: [0.62, 0.86],
    shadows: false,
    shadowSize: 512,
    drawDistance: 700,
    roadWear: 0,
    lightSpacing: 108,
  },
  medium: {
    label: 'BALANCED',
    dpr: [0.78, 1.04],
    shadows: true,
    shadowSize: 1024,
    drawDistance: 940,
    roadWear: 95,
    lightSpacing: 76,
  },
  high: {
    label: 'QUALITY',
    dpr: [1, 1.45],
    shadows: true,
    shadowSize: 1536,
    drawDistance: 1150,
    roadWear: 180,
    lightSpacing: 58,
  },
}

const GRAPHICS_ORDER: GraphicsQuality[] = ['low', 'medium', 'high']

export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function getDefaultGraphicsQuality(): GraphicsQuality {
  if (typeof navigator === 'undefined') return 'medium'
  const device = navigator as Navigator & { deviceMemory?: number }
  if ((device.deviceMemory ?? 8) <= 4 || navigator.hardwareConcurrency <= 4) return 'low'
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    const extension = gl?.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null
    const renderer = extension ? String(gl?.getParameter(extension.UNMASKED_RENDERER_WEBGL) ?? '').toLowerCase() : ''
    if (/intel.*(uhd|hd graphics)|swiftshader|mali-[tg]|adreno \(tm\) 5/.test(renderer)) return 'low'
  } catch {
    // Browser privacy modes may hide GPU details; use the balanced fallback.
  }
  return 'medium'
}

export function getNextGraphicsQuality(current: GraphicsQuality): GraphicsQuality {
  return GRAPHICS_ORDER[(GRAPHICS_ORDER.indexOf(current) + 1) % GRAPHICS_ORDER.length]
}
