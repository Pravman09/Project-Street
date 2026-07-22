export const WORLD_BOUNDS = {
  minX: -950,
  maxX: 950,
  minZ: -720,
  maxZ: 820,
} as const

export const WORLD_WIDTH = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX
export const WORLD_DEPTH = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ
export const WORLD_LIMIT = Math.max(Math.abs(WORLD_BOUNDS.minX), WORLD_BOUNDS.maxX, Math.abs(WORLD_BOUNDS.minZ), WORLD_BOUNDS.maxZ)
export const ROAD_HALF_WIDTH = 10

// These are the signalized streets in the original downtown core. The wider
// region uses free-flowing boulevards, highway junctions, and rural roads.
export const GRID_ROADS_X = [-285, -210, -130, -40, 45, 130, 220, 300] as const
export const GRID_ROADS_Z = [-215, -145, -72, 10, 92, 170, 235] as const
export const ROAD_CENTERS = GRID_ROADS_X

export type RoadKind = 'street' | 'avenue' | 'highway'

export interface RoadSegmentData {
  id: string
  start: [number, number]
  end: [number, number]
  width: number
  kind: RoadKind
}

function polylineRoad(
  id: string,
  points: Array<[number, number]>,
  width: number,
  kind: RoadKind,
): RoadSegmentData[] {
  return points.slice(1).map((point, index) => ({
    id: `${id}-${index}`,
    start: points[index],
    end: point,
    width,
    kind,
  }))
}

const CORE_ROADS: RoadSegmentData[] = [
  { id: 'v-west-edge', start: [-285, -360], end: [-285, 420], width: 18, kind: 'street' },
  { id: 'v-west-industrial', start: [-210, -650], end: [-210, 700], width: 20, kind: 'avenue' },
  { id: 'v-west-mid', start: [-130, -430], end: [-130, 470], width: 18, kind: 'street' },
  { id: 'v-central-west', start: [-40, -650], end: [-40, 760], width: 22, kind: 'avenue' },
  { id: 'v-central-east', start: [45, -650], end: [45, 760], width: 20, kind: 'avenue' },
  { id: 'v-east-mid', start: [130, -430], end: [130, 470], width: 18, kind: 'street' },
  { id: 'v-east-commercial', start: [220, -650], end: [220, 720], width: 22, kind: 'avenue' },
  { id: 'v-east-edge', start: [300, -400], end: [300, 480], width: 18, kind: 'street' },
  { id: 'h-south-edge', start: [-640, -215], end: [620, -215], width: 18, kind: 'street' },
  { id: 'h-south', start: [-900, -145], end: [900, -145], width: 20, kind: 'avenue' },
  { id: 'h-rail', start: [-870, -72], end: [870, -72], width: 22, kind: 'avenue' },
  { id: 'h-central', start: [-900, 10], end: [900, 10], width: 20, kind: 'avenue' },
  { id: 'h-market', start: [-850, 92], end: [850, 92], width: 18, kind: 'street' },
  { id: 'h-north', start: [-810, 170], end: [830, 170], width: 22, kind: 'avenue' },
  { id: 'h-north-edge', start: [-650, 235], end: [790, 235], width: 18, kind: 'street' },
  { id: 'diagonal-meridian', start: [-690, -650], end: [590, 752], width: 22, kind: 'avenue' },
  { id: 'diagonal-harbor', start: [-420, 720], end: [900, -648], width: 20, kind: 'avenue' },
]

const REGIONAL_ARTERIALS: RoadSegmentData[] = [
  { id: 'v-west-boulevard', start: [-760, -560], end: [-760, 610], width: 24, kind: 'avenue' },
  { id: 'v-west-suburb', start: [-580, -620], end: [-580, 650], width: 20, kind: 'avenue' },
  { id: 'v-west-gateway', start: [-420, -630], end: [-420, 690], width: 22, kind: 'avenue' },
  { id: 'v-east-gateway', start: [420, -640], end: [420, 720], width: 22, kind: 'avenue' },
  { id: 'v-east-bay', start: [600, -620], end: [600, 700], width: 20, kind: 'avenue' },
  { id: 'v-east-coast', start: [760, -570], end: [760, 610], width: 24, kind: 'avenue' },
  { id: 'h-outer-south', start: [-790, -570], end: [810, -570], width: 28, kind: 'highway' },
  { id: 'h-port', start: [-830, -420], end: [890, -420], width: 22, kind: 'avenue' },
  { id: 'h-south-gateway', start: [-880, -300], end: [850, -300], width: 20, kind: 'avenue' },
  { id: 'h-north-gateway', start: [-850, 340], end: [860, 340], width: 20, kind: 'avenue' },
  { id: 'h-university', start: [-800, 500], end: [830, 500], width: 22, kind: 'avenue' },
  { id: 'h-ridge', start: [-700, 650], end: [760, 650], width: 24, kind: 'avenue' },
]

const RING_EXPRESSWAY = polylineRoad('ring', [
  [-790, -570],
  [-300, -665],
  [260, -660],
  [690, -570],
  [875, -350],
  [900, 80],
  [820, 480],
  [600, 700],
  [160, 770],
  [-330, 750],
  [-690, 620],
  [-880, 330],
  [-910, -120],
  [-790, -570],
], 30, 'highway')

const COAST_ROAD = polylineRoad('coast-road', [
  [520, -620],
  [650, -490],
  [735, -300],
  [790, -70],
  [815, 180],
  [770, 410],
  [650, 620],
  [520, 750],
], 22, 'avenue')

const RIDGE_ROUTE = polylineRoad('ridge-route', [
  [-900, 410],
  [-810, 560],
  [-660, 690],
  [-470, 760],
  [-285, 690],
  [-180, 560],
  [-70, 420],
  [-40, 285],
], 18, 'street')

const INDUSTRIAL_BYPASS = polylineRoad('industrial-bypass', [
  [-850, -500],
  [-650, -390],
  [-430, -350],
  [-180, -380],
  [80, -470],
  [350, -520],
  [650, -500],
  [860, -390],
], 24, 'highway')

export const ROAD_SEGMENTS: RoadSegmentData[] = [
  ...CORE_ROADS,
  ...REGIONAL_ARTERIALS,
  ...RING_EXPRESSWAY,
  ...COAST_ROAD,
  ...RIDGE_ROUTE,
  ...INDUSTRIAL_BYPASS,
]

export interface RoadBarrierData {
  id: string
  start: [number, number]
  end: [number, number]
  radius: number
}

export interface FlyoverRouteData {
  id: string
  x: number
  z: number
  length: number
  width: number
  rotation: number
  deckHeight: number
  rampLength: number
}

export const FLYOVER_ROUTES: FlyoverRouteData[] = [
  // A mix of compact urban crossings and long express viaducts keeps the
  // elevated network useful rather than turning every bridge into a short hop.
  { id: 'west-gate', x: -420, z: -300, length: 220, width: 24, rotation: Math.PI / 2, deckHeight: 7.6, rampLength: 68 },
  { id: 'bay-connector', x: 500, z: 340, length: 380, width: 24, rotation: Math.PI / 2, deckHeight: 8.4, rampLength: 100 },
  { id: 'airport-express', x: 20, z: -570, length: 720, width: 28, rotation: Math.PI / 2, deckHeight: 9.2, rampLength: 130 },
  { id: 'crosstown-viaduct', x: 15, z: 10, length: 560, width: 24, rotation: Math.PI / 2, deckHeight: 8.2, rampLength: 120 },
]

export interface UnderpassRouteData {
  id: string
  roadId: string
  x: number
  z: number
  length: number
  width: number
  rotation: number
  depth: number
  rampLength: number
}

export const UNDERPASS_ROUTES: UnderpassRouteData[] = [
  { id: 'westside-cut', roadId: 'v-west-boulevard', x: -760, z: -145, length: 310, width: 24, rotation: 0, depth: 5.2, rampLength: 85 },
]

export const FLYOVER_BARRIERS: RoadBarrierData[] = FLYOVER_ROUTES.flatMap((route) => {
  const halfLength = route.length / 2 - 5
  const halfWidth = route.width / 2 - 0.55
  const cos = Math.cos(route.rotation)
  const sin = Math.sin(route.rotation)
  const worldPoint = (localX: number, localZ: number): [number, number] => [
    route.x + cos * localX + sin * localZ,
    route.z - sin * localX + cos * localZ,
  ]
  return [-1, 1].map((side) => ({
    id: `${route.id}-flyover-barrier-${side}`,
    start: worldPoint(halfWidth * side, -halfLength),
    end: worldPoint(halfWidth * side, halfLength),
    radius: 0.3,
  }))
})

export const UNDERPASS_BARRIERS: RoadBarrierData[] = UNDERPASS_ROUTES.flatMap((route) => {
  const halfLength = route.length / 2 - 5
  const halfWidth = route.width / 2 - 0.5
  const cos = Math.cos(route.rotation)
  const sin = Math.sin(route.rotation)
  const worldPoint = (localX: number, localZ: number): [number, number] => [
    route.x + cos * localX + sin * localZ,
    route.z - sin * localX + cos * localZ,
  ]
  return [-1, 1].map((side) => ({
    id: `${route.id}-underpass-wall-${side}`,
    start: worldPoint(halfWidth * side, -halfLength),
    end: worldPoint(halfWidth * side, halfLength),
    radius: 0.35,
  }))
})

export function getFlyoverElevation(x: number, z: number, heading: number) {
  let elevation = 0.08
  for (const route of FLYOVER_ROUTES) {
    const alignment = Math.abs(Math.sin(heading) * Math.sin(route.rotation) + Math.cos(heading) * Math.cos(route.rotation))
    if (alignment < 0.7) continue
    const dx = x - route.x
    const dz = z - route.z
    const cos = Math.cos(route.rotation)
    const sin = Math.sin(route.rotation)
    const localX = cos * dx - sin * dz
    const localZ = sin * dx + cos * dz
    const halfLength = route.length / 2
    if (Math.abs(localX) > route.width / 2 - 0.7 || Math.abs(localZ) > halfLength) continue
    const fromEnd = halfLength - Math.abs(localZ)
    const rampProgress = Math.min(1, fromEnd / route.rampLength)
    elevation = Math.max(elevation, 0.08 + route.deckHeight * rampProgress)
  }
  if (elevation > 0.1) return elevation

  for (const route of UNDERPASS_ROUTES) {
    const alignment = Math.abs(Math.sin(heading) * Math.sin(route.rotation) + Math.cos(heading) * Math.cos(route.rotation))
    if (alignment < 0.7) continue
    const dx = x - route.x
    const dz = z - route.z
    const cos = Math.cos(route.rotation)
    const sin = Math.sin(route.rotation)
    const localX = cos * dx - sin * dz
    const localZ = sin * dx + cos * dz
    const halfLength = route.length / 2
    if (Math.abs(localX) > route.width / 2 - 0.7 || Math.abs(localZ) > halfLength) continue
    const fromEnd = halfLength - Math.abs(localZ)
    const rampProgress = Math.min(1, fromEnd / route.rampLength)
    elevation = Math.min(elevation, 0.08 - route.depth * rampProgress)
  }
  return elevation
}

// The city renderer and AI can use the stateless elevation above because their
// routes already define which road they are following. The player needs a
// stateful lookup: at a grade-separated crossing, the same X/Z coordinates can
// describe either the surface road or the bridge deck. Only entering through a
// ramp is allowed to change the player's current road level.
export function getPlayerRoadElevation(x: number, z: number, heading: number, currentElevation: number) {
  let elevation = 0.08

  for (const route of FLYOVER_ROUTES) {
    const alignment = Math.abs(Math.sin(heading) * Math.sin(route.rotation) + Math.cos(heading) * Math.cos(route.rotation))
    if (alignment < 0.7) continue
    const dx = x - route.x
    const dz = z - route.z
    const cos = Math.cos(route.rotation)
    const sin = Math.sin(route.rotation)
    const localX = cos * dx - sin * dz
    const localZ = sin * dx + cos * dz
    const halfLength = route.length / 2
    if (Math.abs(localX) > route.width / 2 - 0.7 || Math.abs(localZ) > halfLength) continue

    const fromEnd = halfLength - Math.abs(localZ)
    const isRampEntrance = fromEnd <= route.rampLength + 2
    const alreadyElevated = currentElevation > 1.05
    if (!isRampEntrance && !alreadyElevated) continue

    const rampProgress = Math.min(1, fromEnd / route.rampLength)
    elevation = Math.max(elevation, 0.08 + route.deckHeight * rampProgress)
  }

  if (elevation > 0.1) return elevation

  for (const route of UNDERPASS_ROUTES) {
    const alignment = Math.abs(Math.sin(heading) * Math.sin(route.rotation) + Math.cos(heading) * Math.cos(route.rotation))
    if (alignment < 0.7) continue
    const dx = x - route.x
    const dz = z - route.z
    const cos = Math.cos(route.rotation)
    const sin = Math.sin(route.rotation)
    const localX = cos * dx - sin * dz
    const localZ = sin * dx + cos * dz
    const halfLength = route.length / 2
    if (Math.abs(localX) > route.width / 2 - 0.7 || Math.abs(localZ) > halfLength) continue

    const fromEnd = halfLength - Math.abs(localZ)
    const isRampEntrance = fromEnd <= route.rampLength + 2
    const alreadyBelowGround = currentElevation < -0.55
    if (!isRampEntrance && !alreadyBelowGround) continue

    const rampProgress = Math.min(1, fromEnd / route.rampLength)
    elevation = Math.min(elevation, 0.08 - route.depth * rampProgress)
  }

  return elevation
}

export type BuildingKind = 'tower' | 'office' | 'apartment' | 'shop' | 'warehouse'
export type CityLotKind = 'park' | 'parking' | 'construction' | 'plaza' | 'stadium' | 'depot' | 'airport' | 'marina' | 'observatory'

export interface BuildingData {
  id: string
  x: number
  z: number
  width: number
  depth: number
  height: number
  color: string
  trim: string
  windowColor: string
  kind: BuildingKind
  seed: number
}

export interface CityLotData {
  id: string
  x: number
  z: number
  width: number
  depth: number
  kind: CityLotKind
}

export interface DistrictData {
  id: string
  name: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export const DISTRICTS: DistrictData[] = [
  { id: 'downtown', name: 'DOWNTOWN MERIDIAN', minX: -340, maxX: 350, minZ: -270, maxZ: 290 },
  { id: 'westside', name: 'WESTSIDE HEIGHTS', minX: -950, maxX: -340, minZ: -280, maxZ: 410 },
  { id: 'ridge', name: 'GRANITE RIDGE', minX: -950, maxX: 260, minZ: 410, maxZ: 820 },
  { id: 'northshore', name: 'NORTHSHORE', minX: 260, maxX: 950, minZ: 300, maxZ: 820 },
  { id: 'bayfront', name: 'BAYFRONT', minX: 350, maxX: 950, minZ: -250, maxZ: 300 },
  { id: 'southworks', name: 'SOUTHWORKS', minX: -950, maxX: 350, minZ: -720, maxZ: -270 },
  { id: 'port', name: 'PORT MERIDIAN', minX: 350, maxX: 950, minZ: -720, maxZ: -250 },
]

export function getDistrictAt(x: number, z: number) {
  return DISTRICTS.find((district) => x >= district.minX && x <= district.maxX && z >= district.minZ && z <= district.maxZ)?.name ?? 'GREATER MERIDIAN'
}

const COLORS: Record<BuildingKind, string[]> = {
  tower: ['#627080', '#526575', '#6d7680', '#536b77'],
  office: ['#6e777d', '#707a83', '#5f707a', '#7a746d'],
  apartment: ['#9a8778', '#8c8179', '#9b9387', '#807b76'],
  shop: ['#8d8478', '#83776d', '#978c7e', '#7b817f'],
  warehouse: ['#697277', '#74787a', '#606b70', '#77736c'],
}

const TRIMS = ['#303b44', '#414a50', '#6f675e', '#d2cec4', '#555e62']
const WINDOW_COLORS = ['#b9cad0', '#d7c29a', '#a8c4cf', '#c6ced0']

function random(seed: number) {
  const value = Math.sin(seed * 91.345 + 17.13) * 47453.5453
  return value - Math.floor(value)
}

export function distanceToRoadSegment(x: number, z: number, road: RoadSegmentData) {
  const [startX, startZ] = road.start
  const [endX, endZ] = road.end
  const dx = endX - startX
  const dz = endZ - startZ
  const lengthSquared = dx * dx + dz * dz
  const t = Math.max(0, Math.min(1, ((x - startX) * dx + (z - startZ) * dz) / lengthSquared))
  const closestX = startX + dx * t
  const closestZ = startZ + dz * t
  return Math.hypot(x - closestX, z - closestZ)
}

function heightFor(kind: BuildingKind, seed: number, regional = false) {
  if (kind === 'tower') return (regional ? 48 : 60) + random(seed) * (regional ? 58 : 66)
  if (kind === 'office') return (regional ? 24 : 34) + random(seed) * 34
  if (kind === 'apartment') return 18 + random(seed) * 27
  if (kind === 'shop') return 8 + random(seed) * 12
  return 10 + random(seed) * 17
}

export const SPECIAL_LOTS: CityLotData[] = [
  { id: 'central-park', x: 3, z: 51, width: 65, depth: 62, kind: 'park' },
  { id: 'central-parking', x: 88, z: 51, width: 65, depth: 62, kind: 'parking' },
  { id: 'civic-plaza', x: 3, z: -31, width: 65, depth: 62, kind: 'plaza' },
  { id: 'west-construction', x: -312, z: 265, width: 35, depth: 40, kind: 'construction' },
  { id: 'meridian-stadium', x: 175, z: 131, width: 70, depth: 58, kind: 'stadium' },
  { id: 'transit-depot', x: -248, z: 203, width: 55, depth: 45, kind: 'depot' },
  { id: 'east-pocket-park', x: 260, z: -109, width: 60, depth: 53, kind: 'park' },
  { id: 'meridian-airfield', x: 650, z: -500, width: 250, depth: 120, kind: 'airport' },
  { id: 'bayfront-marina', x: 850, z: 150, width: 115, depth: 250, kind: 'marina' },
  { id: 'ridge-observatory', x: -610, z: 600, width: 95, depth: 85, kind: 'observatory' },
  { id: 'northshore-park', x: 530, z: 500, width: 105, depth: 95, kind: 'park' },
  { id: 'southworks-depot', x: -640, z: -500, width: 120, depth: 90, kind: 'depot' },
]

interface AxisLot {
  center: number
  size: number
}

const CORE_X: AxisLot[] = [
  { center: -312.5, size: 35 }, { center: -247.5, size: 55 }, { center: -170, size: 60 },
  { center: -85, size: 70 }, { center: 2.5, size: 65 }, { center: 87.5, size: 65 },
  { center: 175, size: 70 }, { center: 260, size: 60 }, { center: 325, size: 30 },
]

const CORE_Z: AxisLot[] = [
  { center: -245, size: 40 }, { center: -180, size: 50 }, { center: -108.5, size: 53 },
  { center: -31, size: 62 }, { center: 51, size: 62 }, { center: 131, size: 58 },
  { center: 202.5, size: 45 }, { center: 265, size: 40 },
]

function overlapsSpecialLot(x: number, z: number, padding: number) {
  return SPECIAL_LOTS.some((lot) => Math.abs(x - lot.x) < lot.width / 2 + padding && Math.abs(z - lot.z) < lot.depth / 2 + padding)
}

function coreKind(xIndex: number, zIndex: number): BuildingKind {
  const centerDistance = Math.abs(xIndex - 4.5) + Math.abs(zIndex - 3.5)
  if (centerDistance < 2.2) return (xIndex + zIndex) % 3 === 0 ? 'office' : 'tower'
  if (xIndex <= 1 || zIndex >= 6) return (xIndex + zIndex) % 2 === 0 ? 'warehouse' : 'apartment'
  if (xIndex >= 7 || zIndex === 0) return (xIndex + zIndex) % 2 === 0 ? 'shop' : 'apartment'
  return (xIndex + zIndex) % 3 === 0 ? 'office' : (xIndex + zIndex) % 2 === 0 ? 'apartment' : 'shop'
}

const CORE_BUILDINGS: BuildingData[] = CORE_X.flatMap((lotX, xIndex) =>
  CORE_Z.flatMap((lotZ, zIndex) => {
    if (lotX.size < 38 || overlapsSpecialLot(lotX.center, lotZ.center, 4)) return []
    const kind = coreKind(xIndex, zIndex)
    const seed = xIndex * 47 + zIndex * 17 + 5
    const splitLot = kind === 'shop' || (kind === 'apartment' && random(seed + 8) > 0.5)
    const count = splitLot ? 2 : 1
    return Array.from({ length: count }, (_, buildingIndex) => {
      const localSeed = seed + buildingIndex * 101
      const width = splitLot ? lotX.size * (0.3 + random(localSeed) * 0.06) : lotX.size * (0.55 + random(localSeed) * 0.16)
      const depth = lotZ.size * (0.53 + random(localSeed + 1) * 0.18)
      const splitOffset = splitLot ? lotX.size * 0.22 * (buildingIndex === 0 ? -1 : 1) : 0
      return {
        id: `core-${xIndex}-${zIndex}-${buildingIndex}`,
        x: lotX.center + splitOffset + (random(localSeed + 2) - 0.5) * (splitLot ? 1.5 : 4),
        z: lotZ.center + (random(localSeed + 3) - 0.5) * 4,
        width,
        depth,
        height: heightFor(kind, localSeed + 5),
        color: COLORS[kind][Math.floor(random(localSeed + 4) * COLORS[kind].length)],
        trim: TRIMS[(xIndex * 2 + zIndex + buildingIndex) % TRIMS.length],
        windowColor: WINDOW_COLORS[(xIndex + zIndex * 2 + buildingIndex) % WINDOW_COLORS.length],
        kind,
        seed: localSeed,
      }
    }).filter((building) => ROAD_SEGMENTS.every((road) =>
      distanceToRoadSegment(building.x, building.z, road) > road.width / 2 + Math.max(building.width, building.depth) * 0.54))
  }),
)

interface RegionalGrid {
  id: string
  xs: number[]
  zs: number[]
  kinds: BuildingKind[]
}

const REGIONAL_GRIDS: RegionalGrid[] = [
  { id: 'westside', xs: [-855, -670, -500, -350], zs: [-505, -360, -255, -180, -110, -35, 130, 205, 285, 420, 575, 710], kinds: ['apartment', 'shop', 'apartment', 'office'] },
  { id: 'bayfront', xs: [355, 510, 680, 850], zs: [-505, -360, -255, -180, -110, -35, 130, 205, 285, 420, 575, 710], kinds: ['office', 'apartment', 'shop', 'tower'] },
  { id: 'southworks', xs: [-845, -670, -500, -350, -285, -125, 85, 300, 510, 700, 850], zs: [-650, -615, -505, -360], kinds: ['warehouse', 'warehouse', 'shop'] },
  { id: 'northland', xs: [-845, -670, -500, -350, -285, -125, 85, 300, 510, 680, 850], zs: [285, 420, 575, 710], kinds: ['apartment', 'office', 'shop', 'apartment'] },
]

const REGIONAL_BUILDINGS: BuildingData[] = REGIONAL_GRIDS.flatMap((grid, gridIndex) =>
  grid.xs.flatMap((x, xIndex) => grid.zs.flatMap((z, zIndex) => {
    const seed = 900 + gridIndex * 503 + xIndex * 41 + zIndex * 19
    let kind = grid.kinds[(xIndex + zIndex * 2) % grid.kinds.length]
    if (grid.id === 'bayfront' && x < 680 && z > 80 && random(seed) > 0.48) kind = 'tower'
    const width = 36 + random(seed + 1) * (kind === 'warehouse' ? 34 : 23)
    const depth = 34 + random(seed + 2) * (kind === 'warehouse' ? 28 : 22)
    const px = x + (random(seed + 3) - 0.5) * 16
    const pz = z + (random(seed + 4) - 0.5) * 15
    if (overlapsSpecialLot(px, pz, Math.max(width, depth) * 0.55)) return []
    if (ROAD_SEGMENTS.some((road) => distanceToRoadSegment(px, pz, road) <= road.width / 2 + Math.max(width, depth) * 0.32)) return []
    return [{
      id: `${grid.id}-${xIndex}-${zIndex}`,
      x: px,
      z: pz,
      width,
      depth,
      height: heightFor(kind, seed + 5, true),
      color: COLORS[kind][Math.floor(random(seed + 6) * COLORS[kind].length)],
      trim: TRIMS[(xIndex + zIndex + gridIndex) % TRIMS.length],
      windowColor: WINDOW_COLORS[(xIndex * 2 + zIndex + gridIndex) % WINDOW_COLORS.length],
      kind,
      seed,
    }]
  })),
)

export const BUILDINGS: BuildingData[] = [...CORE_BUILDINGS, ...REGIONAL_BUILDINGS]

export function isOnRoad(x: number, z: number) {
  return ROAD_SEGMENTS.some((road) => distanceToRoadSegment(x, z, road) <= road.width / 2)
}
