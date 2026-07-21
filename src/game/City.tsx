import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky, useGLTF } from '@react-three/drei'
import {
  CanvasTexture,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  InstancedMesh,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  Points,
  SRGBColorSpace,
  Vector3,
} from 'three'
import {
  BUILDINGS,
  FLYOVER_ROUTES,
  GRID_ROADS_X,
  GRID_ROADS_Z,
  ROAD_SEGMENTS,
  SPECIAL_LOTS,
  UNDERPASS_ROUTES,
  WORLD_BOUNDS,
  WORLD_DEPTH,
  WORLD_WIDTH,
  getFlyoverElevation,
  type BuildingData,
  type CityLotData,
  type RoadSegmentData,
} from './worldLayout'
import { getDynamicVehicles, removeDynamicVehicle, updateDynamicVehicle } from './dynamicVehicles'
import { GRAPHICS_PROFILES, type GraphicsQuality } from './graphicsSettings'
import { isNightTime, type WeatherState } from './dynamicWorld'
import type { CarTelemetry } from './carPhysics'
import type { TrafficDensity } from './gameSettings'
import { getDestructible, registerDestructible, removeDestructible, type DestructibleKind } from './destructibleObjects'

const RIDGE_ESTATE_BUILDING_IDS = [
  'northland-2-2',
  'northland-3-2',
  'northland-5-2',
  'northland-6-2',
  'northland-7-2',
  'northland-8-2',
] as const
const RIDGE_ESTATE_BUILDING_SET = new Set<string>(RIDGE_ESTATE_BUILDING_IDS)
const RIDGE_ESTATE_SITES = RIDGE_ESTATE_BUILDING_IDS.flatMap((id) => {
  const site = BUILDINGS.find((building) => building.id === id)
  return site ? [site] : []
})
const PRIMARY_UNDERPASS = UNDERPASS_ROUTES[0]

function roadMetrics(road: RoadSegmentData) {
  const dx = road.end[0] - road.start[0]
  const dz = road.end[1] - road.start[1]
  return {
    dx,
    dz,
    length: Math.hypot(dx, dz),
    heading: Math.atan2(dx, dz),
    centerX: (road.start[0] + road.end[0]) / 2,
    centerZ: (road.start[1] + road.end[1]) / 2,
  }
}

function gridIntersections() {
  const verticalRoads = ROAD_SEGMENTS.filter((road) => road.id.startsWith('v-'))
  const horizontalRoads = ROAD_SEGMENTS.filter((road) => road.id.startsWith('h-'))
  return GRID_ROADS_X.flatMap((x) =>
    GRID_ROADS_Z.flatMap((z) => {
      const vertical = verticalRoads.find((road) => road.start[0] === x && z >= Math.min(road.start[1], road.end[1]) && z <= Math.max(road.start[1], road.end[1]))
      const horizontal = horizontalRoads.find((road) => road.start[1] === z && x >= Math.min(road.start[0], road.end[0]) && x <= Math.max(road.start[0], road.end[0]))
      return vertical && horizontal ? [[x, z] as const] : []
    }),
  )
}

const SIGNAL_INTERSECTIONS = gridIntersections()

interface BreakablePlacement {
  id: string
  kind: DestructibleKind
  position: [number, number, number]
  rotation: number
  radius: number
  minBreakSpeed: number
}

const BREAKABLE_ROAD_IDS = [
  'h-south', 'h-rail', 'h-central', 'h-market', 'h-north',
  'v-west-industrial', 'v-central-west', 'v-central-east', 'v-east-commercial', 'v-east-edge',
]

const BREAKABLE_PLACEMENTS: BreakablePlacement[] = BREAKABLE_ROAD_IDS.flatMap((roadId, roadIndex) => {
  const road = ROAD_SEGMENTS.find((candidate) => candidate.id === roadId)
  if (!road) return []
  const metrics = roadMetrics(road)
  return [0.2, 0.48, 0.76].map((t, propIndex) => {
    const side = (roadIndex + propIndex) % 2 === 0 ? 1 : -1
    const edge = road.width / 2 + 1.25
    const kind: DestructibleKind = propIndex === 0 ? 'cone' : propIndex === 1 ? 'sign' : 'fence'
    const x = road.start[0] + metrics.dx * t + (metrics.dz / metrics.length) * edge * side
    const z = road.start[1] + metrics.dz * t - (metrics.dx / metrics.length) * edge * side
    return {
      id: `breakable-${roadId}-${propIndex}`,
      kind,
      position: [x, 0.04, z] as [number, number, number],
      rotation: metrics.heading,
      radius: kind === 'fence' ? 1.5 : kind === 'sign' ? 0.58 : 0.34,
      minBreakSpeed: kind === 'fence' ? 7 : kind === 'sign' ? 5 : 2.4,
    }
  })
})

function BreakableProp({ placement, castShadow }: { placement: BreakablePlacement; castShadow: boolean }) {
  const moving = useRef<Group>(null)
  const brokenRef = useRef(false)

  useEffect(() => {
    registerDestructible({
      id: placement.id,
      kind: placement.kind,
      x: placement.position[0],
      y: placement.position[1],
      z: placement.position[2],
      radius: placement.radius,
      minBreakSpeed: placement.minBreakSpeed,
    })
    return () => removeDestructible(placement.id)
  }, [placement])

  useFrame(() => {
    const group = moving.current
    const object = getDestructible(placement.id)
    if (!group || !object) return
    if (object.brokenAt <= 0) {
      if (brokenRef.current) {
        brokenRef.current = false
        group.visible = true
        group.position.set(0, 0, 0)
        group.rotation.set(0, 0, 0)
      }
      return
    }
    brokenRef.current = true
    const elapsed = (performance.now() - object.brokenAt) / 1000
    group.position.x = object.impulseX * elapsed * 0.34
    group.position.z = object.impulseZ * elapsed * 0.34
    group.position.y = Math.max(-0.18, elapsed * 2.5 - elapsed * elapsed * 4.2)
    group.rotation.x = elapsed * (placement.kind === 'cone' ? 8 : 4.8)
    group.rotation.z = elapsed * 3.7
    group.visible = elapsed < 2.4
  })

  return (
    <group position={placement.position} rotation-y={placement.rotation}>
      <group ref={moving}>
        {placement.kind === 'cone' && (
          <>
            <mesh position-y={0.35} castShadow={castShadow}><coneGeometry args={[0.3, 0.72, 9]} /><meshStandardMaterial color="#f16a2c" roughness={0.72} /></mesh>
            <mesh position-y={0.08}><boxGeometry args={[0.62, 0.1, 0.62]} /><meshStandardMaterial color="#1f2528" roughness={0.9} /></mesh>
            <mesh position-y={0.36}><torusGeometry args={[0.2, 0.045, 5, 12]} /><meshBasicMaterial color="#f0eee3" /></mesh>
          </>
        )}
        {placement.kind === 'sign' && (
          <>
            <mesh position-y={1.15} castShadow={castShadow}><cylinderGeometry args={[0.055, 0.07, 2.3, 7]} /><meshStandardMaterial color="#6d7578" metalness={0.64} roughness={0.4} /></mesh>
            <mesh position={[0, 2.08, 0]} castShadow={castShadow}><boxGeometry args={[1.05, 0.62, 0.1]} /><meshStandardMaterial color="#2e80a3" metalness={0.25} roughness={0.52} /></mesh>
            <mesh position={[0, 2.08, 0.056]}><boxGeometry args={[0.62, 0.07, 0.015]} /><meshBasicMaterial color="#e7f5f5" /></mesh>
          </>
        )}
        {placement.kind === 'fence' && (
          <>
            {[-1.2, 0, 1.2].map((x) => <mesh key={x} position={[x, 0.62, 0]} castShadow={castShadow}><boxGeometry args={[0.13, 1.24, 0.15]} /><meshStandardMaterial color="#9a734e" roughness={0.95} /></mesh>)}
            {[0.36, 0.82].map((y) => <mesh key={y} position={[0, y, 0]} castShadow={castShadow}><boxGeometry args={[2.65, 0.14, 0.13]} /><meshStandardMaterial color="#a87c52" roughness={0.96} /></mesh>)}
          </>
        )}
      </group>
    </group>
  )
}

function BreakableRoadsideProps({ graphicsQuality }: { graphicsQuality: GraphicsQuality }) {
  const limit = graphicsQuality === 'high' ? BREAKABLE_PLACEMENTS.length : graphicsQuality === 'medium' ? 23 : 14
  return BREAKABLE_PLACEMENTS.slice(0, limit).map((placement) => (
    <BreakableProp key={placement.id} placement={placement} castShadow={graphicsQuality === 'high'} />
  ))
}

function createWindowTexture(seed: number, windowColor: string, compact: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const color = new Color(windowColor)
  const red = Math.round(color.r * 255)
  const green = Math.round(color.g * 255)
  const blue = Math.round(color.b * 255)
  const rows = compact ? 8 : 14

  context.clearRect(0, 0, canvas.width, canvas.height)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const lit = Math.sin(seed * 31 + row * 17 + column * 13) > 0.2
      const shade = lit ? 0.8 : 0.34
      context.fillStyle = `rgba(${Math.round(red * shade)}, ${Math.round(green * shade)}, ${Math.round(blue * shade)}, 0.88)`
      context.fillRect(6 + column * 17, 8 + row * (compact ? 28 : 17), 11, compact ? 13 : 9)
      context.fillStyle = 'rgba(225, 232, 232, 0.22)'
      context.fillRect(6 + column * 17, 8 + row * (compact ? 28 : 17), 11, 1)
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

function WindowFacade({
  map,
  position,
  rotationY = 0,
  width,
  height,
}: {
  map: CanvasTexture
  position: [number, number, number]
  rotationY?: number
  width: number
  height: number
}) {
  return (
    <mesh position={position} rotation-y={rotationY}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={map} transparent opacity={0.72} depthWrite={false} />
    </mesh>
  )
}

function Building({ data, index }: { data: BuildingData; index: number }) {
  const compactWindows = data.kind === 'shop' || data.kind === 'warehouse'
  const windows = useMemo(
    () => createWindowTexture(data.seed, data.windowColor, compactWindows),
    [compactWindows, data.seed, data.windowColor],
  )
  useEffect(() => () => windows.dispose(), [windows])

  const isGlass = data.kind === 'tower' || data.kind === 'office'
  const facadeHeight = data.height * (data.kind === 'warehouse' ? 0.55 : 0.82)
  const facadeY = data.height / 2 + 0.5
  const facadeWidth = data.width * 0.84
  const facadeDepth = data.depth * 0.84
  const floorBands = data.kind === 'apartment' ? [0.28, 0.48, 0.68, 0.88] : data.kind === 'office' ? [0.32, 0.58, 0.84] : []
  const crownHeight = data.kind === 'tower' ? 5 + (data.seed % 5) : 0

  return (
    <group position={[data.x, 0, data.z]}>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[data.width + 7, 0.28, data.depth + 7]} />
        <meshStandardMaterial color="#b8b5ad" roughness={0.92} />
      </mesh>

      <mesh position={[0, data.height / 2 + 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[data.width, data.height, data.depth]} />
        <meshStandardMaterial
          color={data.color}
          metalness={isGlass ? 0.34 : 0.06}
          roughness={isGlass ? 0.4 : 0.78}
        />
      </mesh>

      <WindowFacade map={windows} position={[0, facadeY, data.depth / 2 + 0.014]} width={facadeWidth} height={facadeHeight} />
      <WindowFacade map={windows} position={[0, facadeY, -data.depth / 2 - 0.014]} rotationY={Math.PI} width={facadeWidth} height={facadeHeight} />
      <WindowFacade map={windows} position={[data.width / 2 + 0.014, facadeY, 0]} rotationY={Math.PI / 2} width={facadeDepth} height={facadeHeight} />
      <WindowFacade map={windows} position={[-data.width / 2 - 0.014, facadeY, 0]} rotationY={-Math.PI / 2} width={facadeDepth} height={facadeHeight} />

      {floorBands.map((heightRatio) => (
        <mesh key={heightRatio} position={[0, data.height * heightRatio, data.depth / 2 + 0.08]}>
          <boxGeometry args={[data.width * 0.94, 0.16, 0.18]} />
          <meshStandardMaterial color={data.trim} metalness={0.25} roughness={0.55} />
        </mesh>
      ))}

      {(data.kind === 'shop' || data.kind === 'office') && (
        <group position={[0, 1.85, data.depth / 2 + 0.18]}>
          <mesh>
            <boxGeometry args={[data.width * 0.78, 2.7, 0.28]} />
            <meshStandardMaterial color="#537078" metalness={0.34} roughness={0.24} />
          </mesh>
          <mesh position={[0, 1.62, 0.35]} rotation-x={-0.13}>
            <boxGeometry args={[data.width * 0.86, 0.2, 0.82]} />
            <meshStandardMaterial color={data.trim} metalness={0.25} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.15, 0.19]}>
            <boxGeometry args={[1.7, 2.35, 0.08]} />
            <meshStandardMaterial color="#30474e" metalness={0.4} roughness={0.2} />
          </mesh>
        </group>
      )}

      {data.kind === 'apartment' && (
        <group position={[0, 1.55, data.depth / 2 + 0.42]}>
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[5.4, 0.24, 2]} />
            <meshStandardMaterial color={data.trim} roughness={0.68} />
          </mesh>
          <mesh>
            <boxGeometry args={[2.5, 2.8, 0.2]} />
            <meshStandardMaterial color="#3e4a4c" metalness={0.2} roughness={0.42} />
          </mesh>
        </group>
      )}

      {data.kind === 'warehouse' && (
        <>
          {[-0.26, 0.26].map((offset) => (
            <group key={offset} position={[data.width * offset, 2.3, data.depth / 2 + 0.16]}>
              <mesh>
                <boxGeometry args={[data.width * 0.34, 4, 0.25]} />
                <meshStandardMaterial color="#535c5e" metalness={0.32} roughness={0.62} />
              </mesh>
              {[1.25, 0.45, -0.35, -1.15].map((y) => (
                <mesh key={y} position={[0, y, 0.15]}>
                  <boxGeometry args={[data.width * 0.3, 0.08, 0.07]} />
                  <meshStandardMaterial color="#30383a" metalness={0.45} roughness={0.5} />
                </mesh>
              ))}
            </group>
          ))}
        </>
      )}

      <mesh position={[0, data.height + 0.52, 0]}>
        <boxGeometry args={[data.width * 1.025, 0.4, data.depth * 1.025]} />
        <meshStandardMaterial color={data.trim} metalness={0.32} roughness={0.58} />
      </mesh>

      {data.kind === 'tower' && (
        <group position={[0, data.height + crownHeight / 2 + 0.7, 0]}>
          <mesh castShadow>
            <boxGeometry args={[data.width * 0.58, crownHeight, data.depth * 0.58]} />
            <meshStandardMaterial color={data.color} metalness={0.38} roughness={0.38} />
          </mesh>
          <mesh position={[0, crownHeight / 2 + 2.4, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
            <meshStandardMaterial color="#555e62" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      )}

      <group position={[data.width * 0.21, data.height + 1.05, -data.depth * 0.14]}>
        <mesh>
          <boxGeometry args={[2.6, 1.45, 2.2]} />
          <meshStandardMaterial color="#626a6c" metalness={0.52} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.82, 0]}>
          <boxGeometry args={[2, 0.16, 1.65]} />
          <meshStandardMaterial color="#8a8d89" metalness={0.62} roughness={0.42} />
        </mesh>
      </group>

      {index % 4 === 0 && data.kind !== 'warehouse' && (
        <group position={[0, data.height * 0.62, data.depth / 2 + 0.1]}>
          <mesh>
            <boxGeometry args={[Math.min(8, data.width * 0.5), 1.15, 0.16]} />
            <meshStandardMaterial color={data.trim} roughness={0.54} />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[Math.min(6, data.width * 0.38), 0.22]} />
            <meshBasicMaterial color="#e8e4d8" />
          </mesh>
        </group>
      )}
    </group>
  )
}

function RegionalBuildings({ night }: { night: boolean }) {
  const buildings = useMemo(() => BUILDINGS.filter((building) => !building.id.startsWith('core-') && !RIDGE_ESTATE_BUILDING_SET.has(building.id)), [])
  const bodies = useRef<InstancedMesh>(null)
  const roofs = useRef<InstancedMesh>(null)
  const frontWindows = useRef<InstancedMesh>(null)
  const sideWindows = useRef<InstancedMesh>(null)
  const bands = useMemo(() => buildings.flatMap((building, buildingIndex) => {
    const levels = building.kind === 'warehouse' ? [0.55] : building.kind === 'shop' ? [0.48, 0.72] : [0.3, 0.5, 0.7, 0.86]
    return levels.map((level) => ({ building, buildingIndex, level }))
  }), [buildings])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    const scale = new Vector3()
    buildings.forEach((building, index) => {
      matrix.makeScale(building.width, building.height, building.depth)
      matrix.setPosition(building.x, building.height / 2 + 0.3, building.z)
      bodies.current?.setMatrixAt(index, matrix)
      bodies.current?.setColorAt(index, new Color(building.color))

      matrix.makeScale(building.width * 1.035, 0.38, building.depth * 1.035)
      matrix.setPosition(building.x, building.height + 0.5, building.z)
      roofs.current?.setMatrixAt(index, matrix)
      roofs.current?.setColorAt(index, new Color(building.trim))
    })

    bands.forEach(({ building, level }, index) => {
      matrix.makeScale(building.width * 0.76, 0.28, 0.09)
      matrix.setPosition(building.x, building.height * level + 0.4, building.z + building.depth / 2 + 0.055)
      frontWindows.current?.setMatrixAt(index, matrix)
      frontWindows.current?.setColorAt(index, new Color(building.windowColor))

      matrix.makeRotationY(Math.PI / 2)
      scale.set(building.depth * 0.76, 0.28, 0.09)
      matrix.scale(scale)
      matrix.setPosition(building.x + building.width / 2 + 0.055, building.height * level + 0.4, building.z)
      sideWindows.current?.setMatrixAt(index, matrix)
      sideWindows.current?.setColorAt(index, new Color(building.windowColor))
    })

    for (const mesh of [bodies.current, roofs.current, frontWindows.current, sideWindows.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [bands, buildings])

  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, buildings.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#758088" metalness={0.14} roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, buildings.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4c555b" metalness={0.3} roughness={0.62} />
      </instancedMesh>
      <instancedMesh ref={frontWindows} args={[undefined, undefined, bands.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#e8c888' : '#afc3ca'} emissive={night ? '#ffbd62' : '#000000'} emissiveIntensity={night ? 1.25 : 0} metalness={0.42} roughness={0.22} />
      </instancedMesh>
      <instancedMesh ref={sideWindows} args={[undefined, undefined, bands.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#d9bf89' : '#afc3ca'} emissive={night ? '#e9a94f' : '#000000'} emissiveIntensity={night ? 0.95 : 0} metalness={0.42} roughness={0.22} />
      </instancedMesh>
    </>
  )
}

function RidgeEstates({ graphicsQuality }: { graphicsQuality: GraphicsQuality }) {
  const { scene } = useGLTF('/models/residential-bungalow.glb')
  const models = useMemo(() => RIDGE_ESTATE_SITES.map(() => scene.clone(true)), [scene])

  useLayoutEffect(() => {
    models.forEach((model) => {
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.castShadow = graphicsQuality !== 'low'
        object.receiveShadow = graphicsQuality !== 'low'
      })
    })
  }, [graphicsQuality, models])

  return (
    <group>
      {RIDGE_ESTATE_SITES.map((site, index) => {
        const houseWidth = Math.min(39, site.width * 0.78)
        const houseDepth = Math.min(36, site.depth * 0.76)
        const yScale = 16.5 + (index % 3) * 1.15
        const modelY = 0.3487 * yScale + 0.18
        return (
          <group key={site.id} position={[site.x, 0, site.z]}>
            <mesh position={[0, 0.12, 0]} receiveShadow>
              <boxGeometry args={[site.width + 6, 0.24, site.depth + 6]} />
              <meshStandardMaterial color={index % 2 ? '#63785d' : '#6b7d62'} roughness={0.96} />
            </mesh>

            <mesh position={[0, 0.25, -site.depth * 0.39]} receiveShadow>
              <boxGeometry args={[6.2 + (index % 2), 0.18, site.depth * 0.27]} />
              <meshStandardMaterial color={index % 2 ? '#aaa59b' : '#bab2a5'} roughness={0.9} />
            </mesh>

            <group
              position={[0, modelY, 0]}
              rotation-y={Math.PI + ((index % 3) - 1) * 0.035}
              scale={[houseWidth, yScale, houseDepth / 0.8212]}
            >
              <primitive object={models[index]} />
            </group>

            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * (site.width / 2 + 0.5), 0.75, 1]} castShadow={graphicsQuality !== 'low'}>
                <boxGeometry args={[1.1, 1.3, site.depth + 3]} />
                <meshStandardMaterial color={index % 2 ? '#304b34' : '#3b5638'} roughness={0.94} />
              </mesh>
            ))}
            <mesh position={[0, 0.75, site.depth / 2 + 0.5]} castShadow={graphicsQuality !== 'low'}>
              <boxGeometry args={[site.width + 2, 1.3, 1.1]} />
              <meshStandardMaterial color="#314b34" roughness={0.94} />
            </mesh>

            {[-4.6, 4.6].map((x) => (
              <group key={x} position={[x, 1.05, -site.depth / 2 - 0.2]}>
                <mesh castShadow={graphicsQuality !== 'low'}>
                  <boxGeometry args={[1.25, 2.1, 1.25]} />
                  <meshStandardMaterial color="#aaa69b" roughness={0.78} />
                </mesh>
                <mesh position={[0, 1.15, 0]}>
                  <sphereGeometry args={[0.18, 8, 6]} />
                  <meshBasicMaterial color="#ffe0a8" />
                </mesh>
              </group>
            ))}

            <pointLight position={[0, 4.1, -site.depth * 0.32]} color="#ffd7a0" intensity={graphicsQuality === 'low' ? 0 : 16} distance={18} />
          </group>
        )
      })}
      <group position={[-38, 0, 535]}>
        {[-9, 9].map((x) => (
          <mesh key={x} position={[x, 2.4, 0]} castShadow>
            <boxGeometry args={[1.5, 4.8, 1.5]} />
            <meshStandardMaterial color="#a9a393" roughness={0.74} />
          </mesh>
        ))}
        <mesh position={[0, 4.4, 0]}>
          <boxGeometry args={[19.5, 1.1, 1.4]} />
          <meshStandardMaterial color="#77736a" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/models/residential-bungalow.glb')

function GroundSurface() {
  const margin = 9
  const minX = WORLD_BOUNDS.minX - margin
  const maxX = WORLD_BOUNDS.maxX + margin
  const minZ = WORLD_BOUNDS.minZ - margin
  const maxZ = WORLD_BOUNDS.maxZ + margin
  const trenchHalfWidth = PRIMARY_UNDERPASS.width / 2 + 4
  const trenchHalfLength = PRIMARY_UNDERPASS.length / 2 + 1
  const trenchMinX = PRIMARY_UNDERPASS.x - trenchHalfWidth
  const trenchMaxX = PRIMARY_UNDERPASS.x + trenchHalfWidth
  const trenchMinZ = PRIMARY_UNDERPASS.z - trenchHalfLength
  const trenchMaxZ = PRIMARY_UNDERPASS.z + trenchHalfLength
  const tiles = [
    { x: (minX + trenchMinX) / 2, z: (minZ + maxZ) / 2, width: trenchMinX - minX, depth: maxZ - minZ },
    { x: (trenchMaxX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - trenchMaxX, depth: maxZ - minZ },
    { x: PRIMARY_UNDERPASS.x, z: (minZ + trenchMinZ) / 2, width: trenchHalfWidth * 2, depth: trenchMinZ - minZ },
    { x: PRIMARY_UNDERPASS.x, z: (trenchMaxZ + maxZ) / 2, width: trenchHalfWidth * 2, depth: maxZ - trenchMaxZ },
  ]

  return tiles.map((tile, index) => (
    <mesh key={index} position={[tile.x, 0, tile.z]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[tile.width, tile.depth]} />
      <meshStandardMaterial color="#777c72" roughness={0.96} />
    </mesh>
  ))
}

function RoadSurfaces({ graphicsQuality, weather }: { graphicsQuality: GraphicsQuality; weather: WeatherState }) {
  const surfaceRoads = useMemo<RoadSegmentData[]>(() => ROAD_SEGMENTS.flatMap((road) => {
    if (road.id !== PRIMARY_UNDERPASS.roadId) return [road]
    const halfLength = PRIMARY_UNDERPASS.length / 2
    return [
      { ...road, id: `${road.id}-south-surface`, end: [road.start[0], PRIMARY_UNDERPASS.z - halfLength] as [number, number] },
      { ...road, id: `${road.id}-north-surface`, start: [road.end[0], PRIMARY_UNDERPASS.z + halfLength] as [number, number] },
    ]
  }), [])

  return (
    <>
      {surfaceRoads.map((road) => {
        const metrics = roadMetrics(road)
        const edgeOffset = road.width / 2 - 0.8
        return (
          <group key={road.id} position={[metrics.centerX, 0, metrics.centerZ]} rotation-y={metrics.heading}>
            <mesh position={[0, 0.025, 0]} rotation-x={-Math.PI / 2} receiveShadow>
              <planeGeometry args={[road.width, metrics.length]} />
              <meshStandardMaterial
                color={road.kind === 'highway' ? '#20262a' : road.kind === 'avenue' ? '#272d31' : '#2c3134'}
                roughness={weather === 'rain' ? (graphicsQuality === 'high' ? 0.19 : 0.28) : graphicsQuality === 'high' ? (road.kind === 'highway' ? 0.53 : 0.6) : road.kind === 'highway' ? 0.68 : 0.76}
                metalness={weather === 'rain' ? (graphicsQuality === 'high' ? 0.52 : 0.34) : graphicsQuality === 'high' ? 0.17 : road.kind === 'highway' ? 0.1 : 0.07}
              />
            </mesh>
            {[-edgeOffset, edgeOffset].map((edge) => (
              <mesh key={edge} position={[edge, 0.052, 0]}>
                <boxGeometry args={[0.13, 0.025, metrics.length]} />
                <meshBasicMaterial color="#d6d4cc" />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}

function RoadMarkings() {
  const markings = useRef<InstancedMesh>(null)
  const dashes = useMemo(() => {
    return ROAD_SEGMENTS.filter((road) => road.kind !== 'highway').flatMap((road) => {
      const metrics = roadMetrics(road)
      const count = Math.max(1, Math.floor(metrics.length / 12))
      return Array.from({ length: count }, (_, index) => {
        const t = (index + 0.5) / count
        return {
          x: road.start[0] + metrics.dx * t,
          z: road.start[1] + metrics.dz * t,
          heading: metrics.heading,
        }
      })
    })
  }, [])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    dashes.forEach((dash, index) => {
      const elevation = getFlyoverElevation(dash.x, dash.z, dash.heading)
      matrix.makeRotationY(dash.heading)
      matrix.setPosition(dash.x, Math.abs(elevation - 0.08) < 0.01 ? 0.06 : elevation - 0.05, dash.z)
      markings.current?.setMatrixAt(index, matrix)
    })
    if (markings.current) markings.current.instanceMatrix.needsUpdate = true
  }, [dashes])

  return (
    <instancedMesh ref={markings} args={[undefined, undefined, dashes.length]}>
      <boxGeometry args={[0.16, 0.025, 5.7]} />
      <meshBasicMaterial color="#e5c85c" />
    </instancedMesh>
  )
}

function RoadWear({ count }: { count: number }) {
  const wear = useRef<InstancedMesh>(null)
  const patches = useMemo(() => Array.from({ length: count }, (_, index) => {
    const road = ROAD_SEGMENTS[(index * 17 + 5) % ROAD_SEGMENTS.length]
    const metrics = roadMetrics(road)
    const seed = ((index * 47) % 101) / 101
    const lateral = ((((index * 29) % 31) / 30) - 0.5) * Math.max(2, road.width - 5)
    const perpendicularX = metrics.dz / metrics.length
    const perpendicularZ = -metrics.dx / metrics.length
    return {
      x: road.start[0] + metrics.dx * seed + perpendicularX * lateral,
      z: road.start[1] + metrics.dz * seed + perpendicularZ * lateral,
      heading: metrics.heading + (((index * 13) % 7) - 3) * 0.025,
      width: 0.16 + (index % 4) * 0.05,
      length: 2.2 + (index % 6) * 0.75,
    }
  }), [count])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    patches.forEach((patch, index) => {
      const elevation = getFlyoverElevation(patch.x, patch.z, patch.heading)
      dummy.position.set(patch.x, Math.abs(elevation - 0.08) < 0.01 ? 0.064 : elevation - 0.045, patch.z)
      dummy.rotation.set(0, patch.heading, 0)
      dummy.scale.set(patch.width, 0.018, patch.length)
      dummy.updateMatrix()
      wear.current?.setMatrixAt(index, dummy.matrix)
    })
    if (wear.current) wear.current.instanceMatrix.needsUpdate = true
  }, [patches])

  if (!count) return null
  return (
    <instancedMesh ref={wear} args={[undefined, undefined, patches.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#171b1d" transparent opacity={0.34} />
    </instancedMesh>
  )
}

function HighwayInfrastructure() {
  const laneMarkings = useRef<InstancedMesh>(null)
  const highways = useMemo(() => ROAD_SEGMENTS.filter((road) => road.kind === 'highway'), [])
  const dashes = useMemo(() => highways.flatMap((road) => {
    const metrics = roadMetrics(road)
    const perpendicularX = metrics.dz / metrics.length
    const perpendicularZ = -metrics.dx / metrics.length
    const count = Math.max(1, Math.floor(metrics.length / 14))
    return [-road.width / 4, road.width / 4].flatMap((lane) =>
      Array.from({ length: count }, (_, index) => {
        const t = (index + 0.5) / count
        return {
          x: road.start[0] + metrics.dx * t + perpendicularX * lane,
          z: road.start[1] + metrics.dz * t + perpendicularZ * lane,
          heading: metrics.heading,
        }
      }))
  }), [highways])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    const scale = new Vector3()
    dashes.forEach((dash, index) => {
      matrix.makeRotationY(dash.heading)
      scale.set(0.13, 0.025, 6.4)
      matrix.scale(scale)
      matrix.setPosition(dash.x, 0.065, dash.z)
      laneMarkings.current?.setMatrixAt(index, matrix)
    })
    if (laneMarkings.current) laneMarkings.current.instanceMatrix.needsUpdate = true
  }, [dashes])

  return (
    <>
      <instancedMesh ref={laneMarkings} args={[undefined, undefined, dashes.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e7e7e2" />
      </instancedMesh>
    </>
  )
}

const FLYOVERS = FLYOVER_ROUTES.map((route) => ({
  ...route,
  label: route.id.replaceAll('-', ' ').toUpperCase(),
}))

function FlyoverStructure({ flyover }: { flyover: (typeof FLYOVERS)[number] }) {
  const flatLength = flyover.length - flyover.rampLength * 2
  const slopeLength = Math.hypot(flyover.rampLength, flyover.deckHeight)
  const angle = Math.atan2(flyover.deckHeight, flyover.rampLength)
  const railOffset = flyover.width / 2 - 0.5
  const supportCount = Math.max(2, Math.floor(flatLength / 54))
  const supportSpacing = flatLength / supportCount
  const supportHeight = Math.max(3.8, flyover.deckHeight - 1.05)

  return (
    <group position={[flyover.x, 0, flyover.z]} rotation-y={flyover.rotation}>
      <mesh position={[0, flyover.deckHeight - 0.58, 0]} receiveShadow castShadow>
        <boxGeometry args={[flyover.width, 1.15, flatLength]} />
        <meshStandardMaterial color="#40474b" roughness={0.72} metalness={0.18} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[0, flyover.deckHeight / 2 - 0.48, side * (flatLength / 2 + flyover.rampLength / 2)]}
            rotation-x={side * angle}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[flyover.width, 0.96, slopeLength]} />
            <meshStandardMaterial color="#42494d" roughness={0.7} metalness={0.16} />
          </mesh>
          {[-flyover.width / 4, 0, flyover.width / 4].map((x, lane) => (
            <mesh
              key={x}
              position={[x, flyover.deckHeight / 2 + 0.03, side * (flatLength / 2 + flyover.rampLength / 2)]}
              rotation-x={side * angle}
            >
              <boxGeometry args={[lane === 1 ? 0.18 : 0.12, 0.025, slopeLength - 2]} />
              <meshBasicMaterial color={lane === 1 ? '#f1c84e' : '#ecebe4'} />
            </mesh>
          ))}
          {[-1, 1].map((edge) => (
            <mesh
              key={`rail-${edge}`}
              position={[edge * railOffset, flyover.deckHeight / 2 + 0.42, side * (flatLength / 2 + flyover.rampLength / 2)]}
              rotation-x={side * angle}
              castShadow
            >
              <boxGeometry args={[0.42, 0.85, slopeLength]} />
              <meshStandardMaterial color="#afb3b1" metalness={0.58} roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}

      {[-railOffset, railOffset].map((x) => (
        <mesh key={x} position={[x, flyover.deckHeight + 0.42, 0]} castShadow>
          <boxGeometry args={[0.42, 0.85, flatLength]} />
          <meshStandardMaterial color="#afb3b1" metalness={0.58} roughness={0.45} />
        </mesh>
      ))}
      {[-flyover.width / 4, 0, flyover.width / 4].map((x, lane) => (
        <mesh key={x} position={[x, flyover.deckHeight + 0.03, 0]}>
          <boxGeometry args={[lane === 1 ? 0.18 : 0.12, 0.025, flatLength - 2]} />
          <meshBasicMaterial color={lane === 1 ? '#f1c84e' : '#ecebe4'} />
        </mesh>
      ))}

      {[-flyover.width / 3, flyover.width / 3].map((x) => (
        <mesh key={`girder-${x}`} position={[x, flyover.deckHeight - 1.25, 0]} castShadow>
          <boxGeometry args={[0.72, 0.78, flatLength]} />
          <meshStandardMaterial color="#555d61" metalness={0.38} roughness={0.56} />
        </mesh>
      ))}
      {Array.from({ length: supportCount }, (_, index) => {
        const z = -flatLength / 2 + supportSpacing * (index + 0.5)
        return (
          <group key={index} position={[0, 0, z]}>
            {[-flyover.width * 0.3, flyover.width * 0.3].map((x) => (
              <mesh key={x} position={[x, supportHeight / 2, 0]} castShadow>
                <cylinderGeometry args={[0.72, 1.02, supportHeight, 10]} />
                <meshStandardMaterial color="#8f9491" roughness={0.78} />
              </mesh>
            ))}
            <mesh position={[0, flyover.deckHeight - 1.72, 0]} castShadow>
              <boxGeometry args={[flyover.width * 0.78, 0.68, 1.05]} />
              <meshStandardMaterial color="#777e80" roughness={0.69} />
            </mesh>
          </group>
        )
      })}

      {flyover.length >= 350 && [-flatLength * 0.28, flatLength * 0.28].map((z) => (
        <group key={`gantry-${z}`} position={[0, flyover.deckHeight, z]}>
          {[-railOffset + 0.7, railOffset - 0.7].map((x) => (
            <mesh key={x} position={[x, 3.5, 0]}>
              <boxGeometry args={[0.34, 7, 0.45]} />
              <meshStandardMaterial color="#62696b" roughness={0.76} />
            </mesh>
          ))}
          <mesh position={[0, 6.85, 0]}>
            <boxGeometry args={[flyover.width - 1.2, 0.48, 0.55]} />
            <meshStandardMaterial color="#4a5154" metalness={0.35} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function UnderpassStructure({ route }: { route: (typeof UNDERPASS_ROUTES)[number] }) {
  const flatLength = route.length - route.rampLength * 2
  const slopeLength = Math.hypot(route.rampLength, route.depth)
  const angle = Math.atan2(route.depth, route.rampLength)
  const wallOffset = route.width / 2 + 0.45
  const steps = 9
  const stepLength = route.rampLength / steps

  return (
    <group position={[route.x, 0, route.z]} rotation-y={route.rotation}>
      <mesh position={[0, -route.depth - 0.43, 0]} receiveShadow>
        <boxGeometry args={[route.width, 0.86, flatLength]} />
        <meshStandardMaterial color="#252b2e" roughness={0.62} metalness={0.12} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[0, -route.depth / 2 - 0.4, side * (flatLength / 2 + route.rampLength / 2)]}
            rotation-x={-side * angle}
            receiveShadow
          >
            <boxGeometry args={[route.width, 0.8, slopeLength]} />
            <meshStandardMaterial color="#272d30" roughness={0.64} metalness={0.1} />
          </mesh>
          {[-route.width / 4, 0, route.width / 4].map((x, lane) => (
            <mesh
              key={x}
              position={[x, -route.depth / 2 + 0.03, side * (flatLength / 2 + route.rampLength / 2)]}
              rotation-x={-side * angle}
            >
              <boxGeometry args={[lane === 1 ? 0.18 : 0.12, 0.025, slopeLength - 2]} />
              <meshBasicMaterial color={lane === 1 ? '#e5c85c' : '#e7e6df'} />
            </mesh>
          ))}
          {Array.from({ length: steps }, (_, index) => {
            const progress = 1 - (index + 0.5) / steps
            const wallHeight = Math.max(0.55, route.depth * progress + 0.85)
            const z = side * (flatLength / 2 + stepLength * (index + 0.5))
            return [-1, 1].map((edge) => (
              <mesh key={`${index}-${edge}`} position={[edge * wallOffset, -wallHeight / 2 + 0.35, z]} castShadow>
                <boxGeometry args={[1.15, wallHeight, stepLength + 0.3]} />
                <meshStandardMaterial color="#8a8e89" roughness={0.85} />
              </mesh>
            ))
          })}
        </group>
      ))}

      {[-1, 1].map((edge) => (
        <mesh key={edge} position={[edge * wallOffset, -route.depth / 2 + 0.35, 0]} castShadow>
          <boxGeometry args={[1.15, route.depth + 0.7, flatLength + 1]} />
          <meshStandardMaterial color="#858a86" roughness={0.84} />
        </mesh>
      ))}
      {[-route.width / 4, 0, route.width / 4].map((x, lane) => (
        <mesh key={x} position={[x, -route.depth + 0.035, 0]}>
          <boxGeometry args={[lane === 1 ? 0.18 : 0.12, 0.025, flatLength - 2]} />
          <meshBasicMaterial color={lane === 1 ? '#e5c85c' : '#e7e6df'} />
        </mesh>
      ))}

      <mesh position={[0, -0.38, 0]} receiveShadow castShadow>
        <boxGeometry args={[route.width + 10, 0.76, 22]} />
        <meshStandardMaterial color="#555c5f" roughness={0.74} />
      </mesh>
      {[-7.5, 0, 7.5].map((z) => (
        <group key={z} position={[0, -1.05, z]}>
          {[-route.width * 0.3, route.width * 0.3].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[3.8, 0.16, 0.55]} />
              <meshBasicMaterial color="#ffd59a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function FlyoversAndUnderpasses() {
  return (
    <group>
      {FLYOVERS.map((flyover) => <FlyoverStructure key={flyover.label} flyover={flyover} />)}
      {UNDERPASS_ROUTES.map((route) => <UnderpassStructure key={route.id} route={route} />)}
      <group position={[420, 0.1, 340]}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <ringGeometry args={[19, 39, 48]} />
          <meshStandardMaterial color="#303639" roughness={0.72} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[18.5, 18.5, 0.4, 48]} />
          <meshStandardMaterial color="#6d765f" roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.32, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[28.7, 29, 48]} />
          <meshBasicMaterial color="#ebe9df" />
        </mesh>
      </group>
    </group>
  )
}

function Crosswalks() {
  const vertical = useRef<InstancedMesh>(null)
  const horizontal = useRef<InstancedMesh>(null)
  const stripes = 6
  const intersections = useMemo(() => gridIntersections(), [])
  const count = intersections.length * stripes

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    let instance = 0
    intersections.forEach(([x, z]) => {
      for (let stripe = 0; stripe < stripes; stripe += 1) {
        const offset = (stripe - (stripes - 1) / 2) * 2.15
        matrix.makeTranslation(x + offset, 0.07, z)
        vertical.current?.setMatrixAt(instance, matrix)
        matrix.makeTranslation(x, 0.072, z + offset)
        horizontal.current?.setMatrixAt(instance, matrix)
        instance += 1
      }
    })
    if (vertical.current) vertical.current.instanceMatrix.needsUpdate = true
    if (horizontal.current) horizontal.current.instanceMatrix.needsUpdate = true
  }, [intersections])

  return (
    <>
      <instancedMesh ref={vertical} args={[undefined, undefined, count]}>
        <boxGeometry args={[1.05, 0.025, 7.1]} />
        <meshBasicMaterial color="#eceae2" transparent opacity={0.78} />
      </instancedMesh>
      <instancedMesh ref={horizontal} args={[undefined, undefined, count]}>
        <boxGeometry args={[7.1, 0.025, 1.05]} />
        <meshBasicMaterial color="#eceae2" transparent opacity={0.78} />
      </instancedMesh>
    </>
  )
}

function Skyline() {
  const skyline = useRef<InstancedMesh>(null)
  const towers = useMemo(() => {
    const values: Array<{ x: number; z: number; width: number; depth: number; height: number; color: string }> = []
    const colors = ['#77818a', '#68757f', '#8b8c88', '#60717c']
    for (let side = 0; side < 4; side += 1) {
      for (let index = 0; index < 18; index += 1) {
        const xAlong = WORLD_BOUNDS.minX - 25 + index * ((WORLD_WIDTH + 50) / 17)
        const zAlong = WORLD_BOUNDS.minZ - 25 + index * ((WORLD_DEPTH + 50) / 17)
        const xEdge = side === 2 ? WORLD_BOUNDS.minX - 38 - (index % 3) * 10 : WORLD_BOUNDS.maxX + 38 + (index % 3) * 10
        const zEdge = side === 0 ? WORLD_BOUNDS.minZ - 38 - (index % 3) * 10 : WORLD_BOUNDS.maxZ + 38 + (index % 3) * 10
        const width = 14 + ((index * 7 + side * 3) % 12)
        const depth = 13 + ((index * 5 + side * 4) % 10)
        const height = 28 + ((index * 17 + side * 23) % 78)
        values.push({
          x: side < 2 ? xAlong : xEdge,
          z: side < 2 ? zEdge : zAlong,
          width,
          depth,
          height,
          color: colors[(index + side) % colors.length],
        })
      }
    }
    return values
  }, [])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    towers.forEach((tower, index) => {
      matrix.makeScale(tower.width, tower.height, tower.depth)
      matrix.setPosition(tower.x, tower.height / 2, tower.z)
      skyline.current?.setMatrixAt(index, matrix)
      skyline.current?.setColorAt(index, new Color(tower.color))
    })
    if (skyline.current) {
      skyline.current.instanceMatrix.needsUpdate = true
      if (skyline.current.instanceColor) skyline.current.instanceColor.needsUpdate = true
    }
  }, [towers])

  return (
    <instancedMesh ref={skyline} args={[undefined, undefined, towers.length]} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#7a858d" roughness={0.82} />
    </instancedMesh>
  )
}

function StreetLights({ spacing, active }: { spacing: number; active: boolean }) {
  const poles = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const bulbs = useRef<InstancedMesh>(null)
  const lights = useMemo(() => {
    const result: Array<{ position: [number, number, number]; rotation: number }> = []
    ROAD_SEGMENTS.forEach((road) => {
      const metrics = roadMetrics(road)
      const count = Math.max(1, Math.floor(metrics.length / spacing))
      const perpendicularX = metrics.dz / metrics.length
      const perpendicularZ = -metrics.dx / metrics.length
      for (let index = 0; index < count; index += 1) {
        const t = (index + 0.5) / count
        const side = index % 2 === 0 ? 1 : -1
        const edge = (road.width / 2 - 1.2) * side
        const position: [number, number, number] = [
          road.start[0] + metrics.dx * t + perpendicularX * edge,
          0,
          road.start[1] + metrics.dz * t + perpendicularZ * edge,
        ]
        if (getFlyoverElevation(position[0], position[2], metrics.heading) < -0.45) continue
        result.push({
          position,
          rotation: metrics.heading + (side < 0 ? Math.PI : 0),
        })
      }
    })
    return result
  }, [spacing])

  useLayoutEffect(() => {
    const pole = new Object3D()
    const arm = new Object3D()
    const bulb = new Object3D()
    lights.forEach((light, index) => {
      const [x, , z] = light.position
      const cos = Math.cos(light.rotation)
      const sin = Math.sin(light.rotation)
      const offset = (localX: number, localZ = 0) => [x + cos * localX + sin * localZ, z - sin * localX + cos * localZ]
      pole.position.set(x, 3, z)
      pole.rotation.set(0, light.rotation, 0)
      pole.updateMatrix()
      poles.current?.setMatrixAt(index, pole.matrix)
      const [armX, armZ] = offset(0.45)
      arm.position.set(armX, 5.9, armZ)
      arm.rotation.set(0, light.rotation, Math.PI / 2)
      arm.updateMatrix()
      arms.current?.setMatrixAt(index, arm.matrix)
      const [bulbX, bulbZ] = offset(0.88)
      bulb.position.set(bulbX, 5.82, bulbZ)
      bulb.updateMatrix()
      bulbs.current?.setMatrixAt(index, bulb.matrix)
    })
    ;[poles.current, arms.current, bulbs.current].forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    })
  }, [lights])

  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, lights.length]}>
        <cylinderGeometry args={[0.055, 0.085, 6, 8]} />
        <meshStandardMaterial color="#343b40" metalness={0.8} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, lights.length]}>
        <cylinderGeometry args={[0.045, 0.045, 0.9, 8]} />
        <meshStandardMaterial color="#343b40" metalness={0.8} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, lights.length]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshBasicMaterial color={active ? '#ffe6b7' : '#777c7b'} />
      </instancedMesh>
    </>
  )
}

function TrafficSignal({ position, rotation, go }: { position: [number, number, number]; rotation: number; go: boolean }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 2.55, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 5.1, 8]} />
        <meshStandardMaterial color="#30373b" metalness={0.82} roughness={0.3} />
      </mesh>
      <mesh position={[1.4, 4.95, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 2.8, 8]} />
        <meshStandardMaterial color="#30373b" metalness={0.82} roughness={0.3} />
      </mesh>
      <group position={[2.7, 4.65, 0]}>
        <mesh>
          <boxGeometry args={[0.42, 1.3, 0.4]} />
          <meshStandardMaterial color="#202529" metalness={0.38} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.4, -0.22]}>
          <circleGeometry args={[0.11, 12]} />
          <meshBasicMaterial color={go ? '#552b2b' : '#f23838'} />
        </mesh>
        <mesh position={[0, 0, -0.22]}>
          <circleGeometry args={[0.11, 12]} />
          <meshBasicMaterial color="#6b5b25" />
        </mesh>
        <mesh position={[0, -0.4, -0.22]}>
          <circleGeometry args={[0.11, 12]} />
          <meshBasicMaterial color={go ? '#2dcc70' : '#244a34'} />
        </mesh>
      </group>
    </group>
  )
}

function TrafficSignals() {
  const signals = useMemo(() => {
    const values: Array<{ key: string; position: [number, number, number]; rotation: number; go: boolean }> = []
    gridIntersections().forEach(([x, z], index) => {
      if (index % 2 !== 0) return
      const phase = index % 4 === 0
      values.push({ key: `signal-${x}-${z}`, position: [x - 8.2, 0, z - 8.2], rotation: 0, go: phase })
      if (index % 8 === 0) {
        values.push({ key: `signal-opposite-${x}-${z}`, position: [x + 8.2, 0, z + 8.2], rotation: Math.PI, go: !phase })
      }
    })
    return values
  }, [])
  return signals.map(({ key, ...signal }) => <TrafficSignal key={key} {...signal} />)
}

function TreeInstances() {
  const trunks = useRef<InstancedMesh>(null)
  const crowns = useRef<InstancedMesh>(null)
  const positions = useMemo(() => {
    const values: Array<[number, number]> = []
    SPECIAL_LOTS.filter((lot) => lot.kind === 'park').forEach((lot) => {
      const halfWidth = lot.width / 2 - 6
      const halfDepth = lot.depth / 2 - 6
      for (const offset of [-0.75, -0.25, 0.25, 0.75]) {
        values.push([lot.x + halfWidth * offset, lot.z - halfDepth])
        values.push([lot.x + halfWidth * offset, lot.z + halfDepth])
      }
      values.push([lot.x - halfWidth, lot.z - halfDepth * 0.35], [lot.x - halfWidth, lot.z + halfDepth * 0.35])
      values.push([lot.x + halfWidth, lot.z - halfDepth * 0.35], [lot.x + halfWidth, lot.z + halfDepth * 0.35])
    })
    for (let x = WORLD_BOUNDS.minX + 25; x <= WORLD_BOUNDS.maxX - 25; x += 43) {
      values.push([x, WORLD_BOUNDS.minZ + 14], [x, WORLD_BOUNDS.maxZ - 14])
    }
    for (let z = WORLD_BOUNDS.minZ + 35; z <= WORLD_BOUNDS.maxZ - 35; z += 45) {
      values.push([WORLD_BOUNDS.minX + 14, z], [WORLD_BOUNDS.maxX - 14, z])
    }
    for (let x = -890; x <= -80; x += 48) {
      const ridge = 710 + Math.sin(x * 0.018) * 42
      values.push([x, ridge], [x + 18, ridge - 55])
    }
    for (let z = 365; z <= 710; z += 46) {
      values.push([-900, z], [-835, z + 18], [860, z - 12])
    }
    for (let x = 355; x <= 740; x += 52) {
      values.push([x, 555 + Math.sin(x * 0.026) * 35])
    }
    RIDGE_ESTATE_SITES.forEach((site, index) => {
      const backZ = site.z + site.depth / 2 + 4.2
      for (const offset of [-0.34, 0, 0.34]) values.push([site.x + site.width * offset, backZ])
      const sideX = index % 2 === 0 ? site.x - site.width / 2 - 4 : site.x + site.width / 2 + 4
      values.push([sideX, site.z - site.depth * 0.24], [sideX, site.z + site.depth * 0.18])
    })
    for (let z = -330; z <= 430; z += 58) values.push([786, z])
    values.push([-26, -56], [28, -56], [-26, -6], [28, -6], [58, 25], [112, 25], [58, 77], [112, 77])
    return values
  }, [])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    positions.forEach(([x, z], index) => {
      const scale = 0.82 + (index % 5) * 0.06
      matrix.makeScale(scale, 1, scale)
      matrix.setPosition(x, 1.6, z)
      trunks.current?.setMatrixAt(index, matrix)
      matrix.makeScale(1.45 * scale, 1.75 * scale, 1.45 * scale)
      matrix.setPosition(x, 4.35, z)
      crowns.current?.setMatrixAt(index, matrix)
      crowns.current?.setColorAt(index, new Color(index % 3 === 0 ? '#506f45' : index % 3 === 1 ? '#41663f' : '#5a7648'))
    })
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
    if (crowns.current) {
      crowns.current.instanceMatrix.needsUpdate = true
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
    }
  }, [positions])

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 3.2, 7]} />
        <meshStandardMaterial color="#72533b" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, positions.length]} castShadow>
        <icosahedronGeometry args={[1.65, 1]} />
        <meshStandardMaterial color="#4f7247" roughness={0.94} />
      </instancedMesh>
    </>
  )
}

function DistrictPolish() {
  const promenadePlanters = [-300, -190, -80, 30, 140, 250, 360, 470]
  const containerStacks = [
    { x: -710, z: -495, rotation: 0.04 },
    { x: -540, z: -488, rotation: -0.05 },
    { x: -360, z: -475, rotation: 0.03 },
  ]
  const containerColors = ['#9e493d', '#476b77', '#b7833e']

  return (
    <group>
      {promenadePlanters.map((z, index) => (
        <group key={`promenade-${z}`} position={[792, 0, z]}>
          <mesh position={[0, 0.38, 0]} receiveShadow>
            <boxGeometry args={[5.8, 0.76, 2.25]} />
            <meshStandardMaterial color="#a6a39a" roughness={0.84} />
          </mesh>
          {[-1.65, 0, 1.65].map((x) => (
            <mesh key={x} position={[x, 1.05 + Math.abs(x) * 0.05, 0]} castShadow>
              <dodecahedronGeometry args={[0.82, 0]} />
              <meshStandardMaterial color={index % 2 ? '#496b45' : '#58774c'} roughness={0.96} />
            </mesh>
          ))}
          <mesh position={[0, 0.78, 2.2]}>
            <boxGeometry args={[4.4, 0.16, 0.8]} />
            <meshStandardMaterial color="#72543c" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {containerStacks.map((stack, stackIndex) => (
        <group key={`containers-${stack.x}`} position={[stack.x, 0, stack.z]} rotation-y={stack.rotation}>
          {[0, 1, 2].map((column) => (
            <group key={column} position={[(column - 1) * 7.2, 1.45, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[6.7, 2.9, 14]} />
                <meshStandardMaterial color={containerColors[(column + stackIndex) % containerColors.length]} metalness={0.24} roughness={0.66} />
              </mesh>
              {[-5.2, -1.75, 1.75, 5.2].map((z) => (
                <mesh key={z} position={[0, 0, z]}>
                  <boxGeometry args={[6.76, 2.3, 0.08]} />
                  <meshStandardMaterial color="#515a5c" metalness={0.36} roughness={0.58} />
                </mesh>
              ))}
              {column === 1 && stackIndex !== 1 && (
                <mesh position={[0, 2.92, 0]} castShadow>
                  <boxGeometry args={[6.7, 2.9, 14]} />
                  <meshStandardMaterial color={containerColors[(column + stackIndex + 1) % containerColors.length]} metalness={0.24} roughness={0.66} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={`ridge-sign-${side}`} position={[side * 10.4 - 38, 0, 529]}>
          <mesh position={[0, 1.25, 0]} castShadow>
            <boxGeometry args={[1.65, 2.5, 1.65]} />
            <meshStandardMaterial color="#a8a293" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.62, 0]}>
            <sphereGeometry args={[0.18, 8, 6]} />
            <meshBasicMaterial color="#ffe2ad" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Park({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[lot.width - 5, 0.24, lot.depth - 5]} />
        <meshStandardMaterial color="#667b55" roughness={1} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <boxGeometry args={[5, 0.08, lot.depth - 8]} />
        <meshStandardMaterial color="#c5bca9" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[lot.width - 8, 0.08, 5]} />
        <meshStandardMaterial color="#c5bca9" roughness={0.92} />
      </mesh>
      <group position={[0, 0.4, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[4.1, 4.5, 0.7, 28]} />
          <meshStandardMaterial color="#a7a39a" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[3.5, 3.5, 0.12, 28]} />
          <meshStandardMaterial color="#6e9da4" metalness={0.2} roughness={0.26} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.22, 0.34, 2, 12]} />
          <meshStandardMaterial color="#8f8d85" roughness={0.7} />
        </mesh>
      </group>
      {[-14, 14].flatMap((x) => [-14, 14].map((z) => (
        <group key={`${x}-${z}`} position={[x, 0.7, z]} rotation-y={x === z ? Math.PI / 2 : 0}>
          <mesh>
            <boxGeometry args={[3.3, 0.18, 0.8]} />
            <meshStandardMaterial color="#75543a" roughness={0.86} />
          </mesh>
          <mesh position={[0, 0.65, 0.34]}>
            <boxGeometry args={[3.3, 1.1, 0.15]} />
            <meshStandardMaterial color="#75543a" roughness={0.86} />
          </mesh>
        </group>
      )))}
    </group>
  )
}

function ParkedCar({ position, rotation, color }: { position: [number, number, number]; rotation: number; color: string }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[1.65, 0.55, 3.6]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.36} />
      </mesh>
      <mesh position={[0, 1.02, -0.15]} castShadow>
        <boxGeometry args={[1.35, 0.5, 1.8]} />
        <meshStandardMaterial color="#62767d" metalness={0.45} roughness={0.2} />
      </mesh>
      {[-0.83, 0.83].flatMap((x) => [-1.08, 1.08].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.42, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.28, 0.28, 0.18, 12]} />
          <meshStandardMaterial color="#202224" roughness={0.88} />
        </mesh>
      )))}
    </group>
  )
}

function ParkingLot({ lot }: { lot: CityLotData }) {
  const cars = ['#586e7b', '#8a3e35', '#d1cec4', '#34434a', '#766c57', '#4f654e', '#a6a9a7', '#6c3f45']
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[lot.width - 5, 0.2, lot.depth - 5]} />
        <meshStandardMaterial color="#3a3e3f" roughness={0.88} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => {
        const x = -22.5 + index * 5
        return (
          <group key={index}>
            <mesh position={[x, 0.23, -13]}>
              <boxGeometry args={[0.1, 0.025, 9]} />
              <meshBasicMaterial color="#d9d4bd" />
            </mesh>
            <mesh position={[x, 0.23, 13]}>
              <boxGeometry args={[0.1, 0.025, 9]} />
              <meshBasicMaterial color="#d9d4bd" />
            </mesh>
          </group>
        )
      })}
      {cars.map((color, index) => (
        <ParkedCar
          key={`${color}-${index}`}
          position={[-19 + index * 5.4, 0.05, index % 2 === 0 ? -13 : 13]}
          rotation={index % 2 === 0 ? 0 : Math.PI}
          color={color}
        />
      ))}
      <group position={[21, 2.5, 21]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.1, 5, 8]} />
          <meshStandardMaterial color="#555b5d" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[-1.2, 2.1, 0]}>
          <boxGeometry args={[2.4, 0.8, 0.18]} />
          <meshStandardMaterial color="#376b8c" roughness={0.55} />
        </mesh>
      </group>
    </group>
  )
}

function Plaza({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[lot.width - 5, 0.24, lot.depth - 5]} />
        <meshStandardMaterial color="#c1beb5" roughness={0.9} />
      </mesh>
      {[-18, -6, 6, 18].map((x) => (
        <mesh key={x} position={[x, 0.28, 0]}>
          <boxGeometry args={[0.22, 0.08, lot.depth - 8]} />
          <meshStandardMaterial color="#9d9b95" roughness={0.92} />
        </mesh>
      ))}
      <group position={[0, 2.8, 0]}>
        <mesh rotation-z={Math.PI / 4} castShadow>
          <boxGeometry args={[2.6, 5.2, 2.6]} />
          <meshStandardMaterial color="#8e765b" metalness={0.22} roughness={0.58} />
        </mesh>
        <mesh position={[0, -2.45, 0]}>
          <cylinderGeometry args={[3.1, 3.5, 0.55, 8]} />
          <meshStandardMaterial color="#77746d" roughness={0.82} />
        </mesh>
      </group>
      {[-20, 20].map((x) => (
        <group key={x} position={[x, 1.25, 16]}>
          <mesh>
            <boxGeometry args={[7, 2.4, 3.8]} />
            <meshStandardMaterial color="#725d4d" roughness={0.72} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <boxGeometry args={[7.8, 0.24, 4.5]} />
            <meshStandardMaterial color="#e2ddd0" roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ConstructionSite({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[lot.width - 5, 0.16, lot.depth - 5]} />
        <meshStandardMaterial color="#8b7359" roughness={1} />
      </mesh>
      <group position={[-10, 13, -7]}>
        <mesh>
          <boxGeometry args={[1.2, 26, 1.2]} />
          <meshStandardMaterial color="#c99e32" metalness={0.48} roughness={0.45} />
        </mesh>
        <mesh position={[8, 12.5, 0]}>
          <boxGeometry args={[17, 0.75, 0.75]} />
          <meshStandardMaterial color="#c99e32" metalness={0.48} roughness={0.45} />
        </mesh>
        <mesh position={[15.8, 9.5, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 6, 6]} />
          <meshStandardMaterial color="#3d3d3a" metalness={0.7} />
        </mesh>
      </group>
      {[-15, 0, 15].map((x) => (
        <group key={x} position={[x, 0.8, 11]}>
          <mesh>
            <boxGeometry args={[7, 1.5, 2.4]} />
            <meshStandardMaterial color={x === 0 ? '#d7d2c4' : '#b26e34'} roughness={0.88} />
          </mesh>
        </group>
      ))}
      {[-22, 22].flatMap((x) => [-22, 22].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 1.05, z]}>
          <boxGeometry args={[2.4, 2.1, 0.35]} />
          <meshStandardMaterial color="#d68f2f" roughness={0.72} />
        </mesh>
      )))}
    </group>
  )
}

function Stadium({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[lot.width - 4, 0.28, lot.depth - 4]} />
        <meshStandardMaterial color="#aaa79f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[22, 25, 13, 32, 1, true]} />
        <meshStandardMaterial color="#777f84" metalness={0.18} roughness={0.6} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[17, 17, 1.8, 32]} />
        <meshStandardMaterial color="#5f834e" roughness={0.94} />
      </mesh>
      <mesh position={[0, 2.1, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[17.5, 22.5, 32]} />
        <meshStandardMaterial color="#c7c5bd" roughness={0.84} side={DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 25, 8, 0]}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.22, 15, 8]} />
            <meshStandardMaterial color="#555c60" metalness={0.72} roughness={0.4} />
          </mesh>
          <mesh position={[0, 7.2, 0]}>
            <boxGeometry args={[4.2, 1.8, 0.45]} />
            <meshStandardMaterial color="#e5e2d8" roughness={0.54} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function TransitDepot({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[lot.width - 4, 0.26, lot.depth - 4]} />
        <meshStandardMaterial color="#a8a69f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4.1, 7]} castShadow>
        <boxGeometry args={[lot.width * 0.72, 8, lot.depth * 0.42]} />
        <meshStandardMaterial color="#6a777d" metalness={0.24} roughness={0.52} />
      </mesh>
      <mesh position={[0, 5.1, -1]} rotation-x={-0.12}>
        <boxGeometry args={[lot.width * 0.8, 0.3, lot.depth * 0.38]} />
        <meshStandardMaterial color="#404b50" metalness={0.52} roughness={0.4} />
      </mesh>
      {[-16, -8, 0, 8, 16].map((x) => (
        <mesh key={x} position={[x, 3.7, -lot.depth * 0.22 - 0.05]}>
          <boxGeometry args={[5.2, 4.5, 0.18]} />
          <meshStandardMaterial color="#87a0a7" metalness={0.32} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 8.6, 7]}>
        <boxGeometry args={[18, 1.5, 0.5]} />
        <meshStandardMaterial color="#2f6685" roughness={0.5} />
      </mesh>
    </group>
  )
}

function Airport({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[lot.width, 0.16, lot.depth]} />
        <meshStandardMaterial color="#6d706d" roughness={0.9} />
      </mesh>
      <mesh position={[-5, 0.18, -18]} receiveShadow>
        <boxGeometry args={[lot.width - 20, 0.08, 31]} />
        <meshStandardMaterial color="#292e31" roughness={0.78} />
      </mesh>
      {Array.from({ length: 14 }, (_, index) => (
        <mesh key={index} position={[-105 + index * 16, 0.245, -18]}>
          <boxGeometry args={[8, 0.025, 0.45]} />
          <meshBasicMaterial color="#f1eee0" />
        </mesh>
      ))}
      {Array.from({ length: 18 }, (_, index) => [-1, 1].map((side) => (
        <mesh key={`${index}-${side}`} position={[-112 + index * 13.2, 0.32, -18 + side * 13.2]}>
          <sphereGeometry args={[0.13, 6, 5]} />
          <meshBasicMaterial color={side > 0 ? '#7ed9ff' : '#ffe58a'} />
        </mesh>
      )))}
      <group position={[55, 8.2, 31]}>
        <mesh castShadow>
          <boxGeometry args={[105, 16, 28]} />
          <meshStandardMaterial color="#727d82" metalness={0.2} roughness={0.48} />
        </mesh>
        <mesh position={[0, -0.2, -14.1]}>
          <boxGeometry args={[91, 7, 0.22]} />
          <meshStandardMaterial color="#8eb1bd" metalness={0.38} roughness={0.2} />
        </mesh>
        <mesh position={[0, 8.5, 0]}>
          <boxGeometry args={[113, 1, 31]} />
          <meshStandardMaterial color="#d3d2cb" metalness={0.25} roughness={0.52} />
        </mesh>
      </group>
      <group position={[-80, 14, 32]}>
        <mesh>
          <cylinderGeometry args={[1.8, 2.7, 25, 12]} />
          <meshStandardMaterial color="#d1d0c8" roughness={0.6} />
        </mesh>
        <mesh position={[0, 12.7, 0]}>
          <cylinderGeometry args={[5.2, 4.2, 3.5, 12]} />
          <meshStandardMaterial color="#506a77" metalness={0.32} roughness={0.3} />
        </mesh>
      </group>
      {[-95, -55].map((x) => (
        <group key={x} position={[x, 3.4, 30]}>
          <mesh castShadow>
            <boxGeometry args={[33, 6.5, 28]} />
            <meshStandardMaterial color="#8c918e" metalness={0.15} roughness={0.66} />
          </mesh>
          <mesh position={[0, -0.2, -14.1]}>
            <boxGeometry args={[28, 5, 0.2]} />
            <meshStandardMaterial color="#4f5b60" roughness={0.54} />
          </mesh>
        </group>
      ))}
      <group position={[-18, 2.1, -18]} rotation-y={Math.PI / 2}>
        <mesh castShadow>
          <boxGeometry args={[15, 1.5, 3.6]} />
          <meshStandardMaterial color="#ecebe5" metalness={0.32} roughness={0.42} />
        </mesh>
        <mesh position={[0, 1.35, -0.2]}>
          <boxGeometry args={[5, 1.35, 2.5]} />
          <meshStandardMaterial color="#7394a0" metalness={0.4} roughness={0.22} />
        </mesh>
        {[-4.6, 4.6].map((x) => (
          <mesh key={x} position={[x, -0.45, 4.2]} rotation-x={0.05}>
            <boxGeometry args={[1.1, 0.18, 9]} />
            <meshStandardMaterial color="#d9d9d2" metalness={0.25} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.35, -3.4]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.42, 1.7, 6.6, 8]} />
          <meshStandardMaterial color="#d6d6cf" roughness={0.5} />
        </mesh>
      </group>
      {[-lot.width / 2 + 3, lot.width / 2 - 3].map((x) => (
        <mesh key={x} position={[x, 1.35, 0]}>
          <boxGeometry args={[0.18, 2.7, lot.depth]} />
          <meshStandardMaterial color="#697173" metalness={0.7} roughness={0.5} wireframe />
        </mesh>
      ))}
      <group position={[105, 5.5, -8]}>
        <mesh castShadow><boxGeometry args={[34, 11, 34]} /><meshStandardMaterial color="#858b89" roughness={0.62} /></mesh>
        <mesh position={[0, 0, -17.1]}><boxGeometry args={[29, 7, 0.2]} /><meshStandardMaterial color="#445158" metalness={0.3} roughness={0.3} /></mesh>
      </group>
    </group>
  )
}

function Marina({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[lot.width, 0.16, lot.depth]} />
        <meshStandardMaterial color="#b7ad96" roughness={0.94} />
      </mesh>
      <mesh position={[lot.width * 0.18, 0.16, 0]}>
        <boxGeometry args={[lot.width * 0.56, 0.12, lot.depth * 0.92]} />
        <meshStandardMaterial color="#5f929d" metalness={0.1} roughness={0.3} />
      </mesh>
      {[-86, -43, 0, 43, 86].map((z) => (
        <group key={z} position={[-7, 0.42, z]}>
          <mesh>
            <boxGeometry args={[65, 0.28, 3.2]} />
            <meshStandardMaterial color="#927555" roughness={0.82} />
          </mesh>
          {[8, 24, 40].map((x) => (
            <mesh key={x} position={[x, -0.12, 0]}>
              <cylinderGeometry args={[0.13, 0.16, 2.1, 8]} />
              <meshStandardMaterial color="#5c4b3d" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {[-82, -38, 7, 51, 94].map((z, index) => (
        <group key={z} position={[27 + (index % 2) * 12, 0.65, z + 6]} rotation-y={Math.PI / 2}>
          <mesh>
            <boxGeometry args={[8, 0.7, 2.8]} />
            <meshStandardMaterial color={index % 2 ? '#e8e5dc' : '#3d6681'} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[0.12, 1.5, 0.12]} />
            <meshStandardMaterial color="#d5d6d0" metalness={0.55} roughness={0.36} />
          </mesh>
        </group>
      ))}
      <mesh position={[-lot.width * 0.32, 5.5, 0]} castShadow>
        <boxGeometry args={[26, 11, 86]} />
        <meshStandardMaterial color="#d0c7b7" roughness={0.68} />
      </mesh>
    </group>
  )
}

function Observatory({ lot }: { lot: CityLotData }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[lot.width * 0.48, lot.width * 0.53, 4, 32]} />
        <meshStandardMaterial color="#6d745f" roughness={0.96} />
      </mesh>
      <mesh position={[0, 6.2, 0]} castShadow>
        <cylinderGeometry args={[18, 20, 8, 28]} />
        <meshStandardMaterial color="#d0cec6" roughness={0.65} />
      </mesh>
      <mesh position={[0, 11.2, 0]} castShadow>
        <sphereGeometry args={[16, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c3c5c1" metalness={0.18} roughness={0.54} />
      </mesh>
      <mesh position={[0, 13.6, 4.2]} rotation-x={-0.42}>
        <cylinderGeometry args={[2.2, 3.6, 18, 16]} />
        <meshStandardMaterial color="#4c5960" metalness={0.42} roughness={0.36} />
      </mesh>
      <group position={[28, 3.5, 8]}>
        <mesh>
          <boxGeometry args={[24, 7, 18]} />
          <meshStandardMaterial color="#9a9488" roughness={0.76} />
        </mesh>
        <mesh position={[0, 0, -9.1]}>
          <boxGeometry args={[15, 3.5, 0.15]} />
          <meshStandardMaterial color="#7b9ba3" metalness={0.26} roughness={0.26} />
        </mesh>
      </group>
    </group>
  )
}

function SpecialLots() {
  return SPECIAL_LOTS.map((lot) => {
    if (lot.kind === 'park') return <Park key={lot.id} lot={lot} />
    if (lot.kind === 'parking') return <ParkingLot key={lot.id} lot={lot} />
    if (lot.kind === 'plaza') return <Plaza key={lot.id} lot={lot} />
    if (lot.kind === 'stadium') return <Stadium key={lot.id} lot={lot} />
    if (lot.kind === 'depot') return <TransitDepot key={lot.id} lot={lot} />
    if (lot.kind === 'airport') return <Airport key={lot.id} lot={lot} />
    if (lot.kind === 'marina') return <Marina key={lot.id} lot={lot} />
    if (lot.kind === 'observatory') return <Observatory key={lot.id} lot={lot} />
    return <ConstructionSite key={lot.id} lot={lot} />
  })
}

const TRAFFIC = [
  { roadId: 'v-west-industrial', lane: -3.8, direction: 1, offset: 12, speed: 11, color: '#8b3f37' },
  { roadId: 'v-west-industrial', lane: 3.8, direction: -1, offset: 270, speed: 9, color: '#d1d0c8' },
  { roadId: 'v-central-west', lane: -4, direction: 1, offset: 90, speed: 13, color: '#465d6b' },
  { roadId: 'v-central-east', lane: 4, direction: -1, offset: 325, speed: 10, color: '#6d7658' },
  { roadId: 'v-east-commercial', lane: -4, direction: 1, offset: 460, speed: 12, color: '#8b8173' },
  { roadId: 'v-east-edge', lane: 3.7, direction: -1, offset: 190, speed: 11, color: '#855e49' },
  { roadId: 'h-south', lane: 3.8, direction: 1, offset: 145, speed: 10, color: '#524d55' },
  { roadId: 'h-rail', lane: -4, direction: -1, offset: 55, speed: 12, color: '#9d9f9c' },
  { roadId: 'h-central', lane: 3.8, direction: 1, offset: 310, speed: 9, color: '#456650' },
  { roadId: 'h-market', lane: -3.7, direction: -1, offset: 505, speed: 13, color: '#a56c45' },
  { roadId: 'h-north', lane: 4, direction: 1, offset: 420, speed: 11, color: '#405d72' },
  { roadId: 'h-north-edge', lane: -3.7, direction: -1, offset: 220, speed: 9, color: '#80756a' },
  { roadId: 'diagonal-meridian', lane: -4.2, direction: 1, offset: 140, speed: 14, color: '#b2b0a7' },
  { roadId: 'diagonal-meridian', lane: 4.2, direction: -1, offset: 390, speed: 12, color: '#6c493f' },
  { roadId: 'diagonal-harbor', lane: -4, direction: 1, offset: 280, speed: 13, color: '#4d6870' },
  { roadId: 'diagonal-harbor', lane: 4, direction: -1, offset: 80, speed: 10, color: '#7b785c' },
  { roadId: 'h-outer-south', lane: -6.5, direction: 1, offset: 170, speed: 24, color: '#c5c4bd' },
  { roadId: 'h-outer-south', lane: 6.5, direction: -1, offset: 940, speed: 22, color: '#3e5362' },
  { roadId: 'h-port', lane: -4.2, direction: 1, offset: 420, speed: 16, color: '#785f4d' },
  { roadId: 'h-university', lane: 4, direction: -1, offset: 810, speed: 15, color: '#8d9390' },
  { roadId: 'h-ridge', lane: -4.2, direction: 1, offset: 250, speed: 17, color: '#53644e' },
  { roadId: 'v-west-suburb', lane: 3.8, direction: -1, offset: 690, speed: 14, color: '#9b714e' },
  { roadId: 'v-east-coast', lane: -4.2, direction: 1, offset: 340, speed: 18, color: '#d0cec4' },
  { roadId: 'v-east-bay', lane: 4, direction: -1, offset: 880, speed: 14, color: '#4e6270' },
  { roadId: 'ring-0', lane: -6.8, direction: 1, offset: 105, speed: 25, color: '#746a5e' },
  { roadId: 'ring-5', lane: 6.8, direction: -1, offset: 220, speed: 23, color: '#aeb1ae' },
  { roadId: 'coast-road-2', lane: -4, direction: 1, offset: 55, speed: 16, color: '#38606d' },
  { roadId: 'industrial-bypass-3', lane: 5.5, direction: -1, offset: 145, speed: 21, color: '#85786c' },
] as const

function TrafficCar({
  vehicleId,
  roadId,
  lane,
  direction,
  offset,
  speed,
  color,
  player,
  worldTime,
  paused,
}: (typeof TRAFFIC)[number] & { vehicleId: string; player: CarTelemetry; worldTime: number; paused: boolean }) {
  const root = useRef<Group>(null)
  const brakeLights = useRef<Array<MeshBasicMaterial | null>>([])
  const road = ROAD_SEGMENTS.find((candidate) => candidate.id === roadId) ?? ROAD_SEGMENTS[0]
  const metrics = useMemo(() => roadMetrics(road), [road])
  const progress = useRef(offset)
  const simulationTime = useRef(0)
  const currentSpeed = useRef(speed)
  useEffect(() => () => removeDynamicVehicle(vehicleId), [vehicleId])
  useFrame((_, delta) => {
    if (!root.current || paused) return
    simulationTime.current += Math.min(delta, 0.05)
    const currentTravel = ((progress.current % metrics.length) + metrics.length) % metrics.length
    const currentT = currentTravel / metrics.length
    const perpendicularX = metrics.dz / metrics.length
    const perpendicularZ = -metrics.dx / metrics.length
    const currentX = road.start[0] + metrics.dx * currentT + perpendicularX * lane
    const currentZ = road.start[1] + metrics.dz * currentT + perpendicularZ * lane
    const heading = metrics.heading + (direction < 0 ? Math.PI : 0)
    const forwardX = Math.sin(heading)
    const forwardZ = Math.cos(heading)
    let speedFactor = 1

    const playerDx = player.position[0] - currentX
    const playerDz = player.position[1] - currentZ
    const playerAhead = playerDx * forwardX + playerDz * forwardZ
    const playerSide = Math.abs(playerDx * forwardZ - playerDz * forwardX)
    if (playerAhead > 0 && playerAhead < 30 && playerSide < 4.2) {
      speedFactor = Math.min(speedFactor, Math.max(0, (playerAhead - 4.2) / 22))
    }

    for (const vehicle of getDynamicVehicles()) {
      if (vehicle.id === vehicleId || Math.abs(vehicle.y - root.current.position.y) > 2) continue
      const dx = vehicle.x - currentX
      const dz = vehicle.z - currentZ
      const ahead = dx * forwardX + dz * forwardZ
      const sideDistance = Math.abs(dx * forwardZ - dz * forwardX)
      if (ahead > 0 && ahead < 24 && sideDistance < 3.15) {
        speedFactor = Math.min(speedFactor, Math.max(0, (ahead - 3.8) / 17))
      }
    }

    const signalPhase = Math.floor((simulationTime.current + worldTime * 0.08) / 8) % 2
    const movingMostlyEastWest = Math.abs(forwardX) > Math.abs(forwardZ)
    const hasGreen = movingMostlyEastWest ? signalPhase === 0 : signalPhase === 1
    if (!hasGreen && road.kind !== 'highway') {
      for (const [signalX, signalZ] of SIGNAL_INTERSECTIONS) {
        const dx = signalX - currentX
        const dz = signalZ - currentZ
        const ahead = dx * forwardX + dz * forwardZ
        const sideDistance = Math.abs(dx * forwardZ - dz * forwardX)
        if (ahead > 1.8 && ahead < 15 && sideDistance < road.width * 0.52) {
          speedFactor = Math.min(speedFactor, Math.max(0, (ahead - 3.2) / 8))
        }
      }
    }

    const response = speedFactor < currentSpeed.current / speed ? 5.8 : 2.1
    currentSpeed.current += (speed * speedFactor - currentSpeed.current) * (1 - Math.exp(-response * Math.min(delta, 0.05)))
    progress.current += currentSpeed.current * direction * Math.min(delta, 0.05)
    const travel = ((progress.current % metrics.length) + metrics.length) % metrics.length
    const t = travel / metrics.length
    const x = road.start[0] + metrics.dx * t + perpendicularX * lane
    const z = road.start[1] + metrics.dz * t + perpendicularZ * lane
    root.current.position.set(x, getFlyoverElevation(x, z, heading) + 0.02, z)
    root.current.rotation.y = heading
    brakeLights.current.forEach((material) => material?.color.set(speedFactor < 0.72 ? '#ff1739' : '#67131d'))
    updateDynamicVehicle({
      id: vehicleId,
      kind: 'traffic',
      x: root.current.position.x,
      y: root.current.position.y,
      z: root.current.position.z,
      heading: root.current.rotation.y,
      speed: currentSpeed.current,
      radius: 1.45,
    })
  })

  return (
    <group ref={root}>
      <mesh position={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[1.65, 0.55, 3.6]} />
        <meshStandardMaterial color={color} metalness={0.44} roughness={0.36} />
      </mesh>
      <mesh position={[0, 1.02, -0.12]} castShadow>
        <boxGeometry args={[1.34, 0.5, 1.85]} />
        <meshStandardMaterial color="#607780" metalness={0.48} roughness={0.22} />
      </mesh>
      {[-0.83, 0.83].flatMap((x) => [-1.08, 1.08].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.4, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.28, 0.28, 0.18, 10]} />
          <meshStandardMaterial color="#202224" roughness={0.9} />
        </mesh>
      )))}
      <mesh position={[-0.5, 0.62, 1.83]}>
        <boxGeometry args={[0.25, 0.16, 0.08]} />
        <meshBasicMaterial color="#fff3c4" />
      </mesh>
      <mesh position={[0.5, 0.62, 1.83]}>
        <boxGeometry args={[0.25, 0.16, 0.08]} />
        <meshBasicMaterial color="#fff3c4" />
      </mesh>
      {[-0.5, 0.5].map((x, index) => <mesh key={x} position={[x, 0.62, -1.83]}><boxGeometry args={[0.28, 0.16, 0.08]} /><meshBasicMaterial ref={(material) => { brakeLights.current[index] = material }} color="#67131d" toneMapped={false} /></mesh>)}
    </group>
  )
}

function AmbientTraffic({ graphicsQuality, worldTime, weather, trafficDensity, player, paused }: { graphicsQuality: GraphicsQuality; worldTime: number; weather: WeatherState; trafficDensity: TrafficDensity; player: CarTelemetry; paused: boolean }) {
  const night = isNightTime(worldTime)
  const qualityLimit = graphicsQuality === 'high' ? TRAFFIC.length : graphicsQuality === 'medium' ? 19 : 11
  const worldFactor = weather === 'rain' ? 0.7 : night ? 0.62 : 1
  const densityFactor = trafficDensity === 'high' ? 1 : trafficDensity === 'medium' ? 0.78 : 0.5
  const visibleCars = Math.max(5, Math.floor(qualityLimit * worldFactor * densityFactor))
  return TRAFFIC.slice(0, visibleCars).map((car, index) => <TrafficCar key={index} vehicleId={`traffic-${index}`} player={player} worldTime={worldTime} paused={paused} {...car} />)
}

function AmbientPursuit({ graphicsQuality, worldTime }: { graphicsQuality: GraphicsQuality; worldTime: number }) {
  const racer = useRef<Group>(null)
  const interceptor = useRef<Group>(null)
  const activeRef = useRef(false)
  const road = ROAD_SEGMENTS.find((candidate) => candidate.id === 'h-outer-south') ?? ROAD_SEGMENTS[0]
  const metrics = useMemo(() => roadMetrics(road), [road])

  useEffect(() => () => {
    removeDynamicVehicle('ambient-rival')
    removeDynamicVehicle('ambient-interceptor')
  }, [])

  useFrame(({ clock }) => {
    const active = (clock.elapsedTime + worldTime * 0.04) % 88 < 34
    if (racer.current) racer.current.visible = active
    if (interceptor.current) interceptor.current.visible = active
    if (!active) {
      if (activeRef.current) {
        removeDynamicVehicle('ambient-rival')
        removeDynamicVehicle('ambient-interceptor')
      }
      activeRef.current = false
      return
    }
    activeRef.current = true

    const place = (root: Group | null, vehicleId: string, offset: number, speed: number) => {
      if (!root) return
      const travel = (clock.elapsedTime * speed + offset) % metrics.length
      const t = travel / metrics.length
      const x = road.start[0] + metrics.dx * t - (metrics.dz / metrics.length) * 5.8
      const z = road.start[1] + metrics.dz * t + (metrics.dx / metrics.length) * 5.8
      root.position.set(x, getFlyoverElevation(x, z, metrics.heading) + 0.04, z)
      root.rotation.y = metrics.heading
      updateDynamicVehicle({ id: vehicleId, kind: 'traffic', x, y: root.position.y, z, heading: metrics.heading, speed, radius: 1.5 })
    }
    place(racer.current, 'ambient-rival', 120, 29)
    place(interceptor.current, 'ambient-interceptor', 84, 30.5)
  })

  const wheels = [-0.78, 0.78].flatMap((x) => [-1.08, 1.08].map((z) => (
    <mesh key={`${x}-${z}`} position={[x, 0.36, z]} rotation-z={Math.PI / 2}>
      <cylinderGeometry args={[0.27, 0.27, 0.16, 8]} />
      <meshStandardMaterial color="#191c20" roughness={0.92} />
    </mesh>
  )))

  return (
    <>
      <group ref={racer} visible={false}>
        <mesh position={[0, 0.6, 0]} castShadow={graphicsQuality === 'high'}><boxGeometry args={[1.7, 0.58, 3.7]} /><meshStandardMaterial color="#d940a1" metalness={0.58} roughness={0.27} /></mesh>
        <mesh position={[0, 1.01, -0.14]}><boxGeometry args={[1.32, 0.45, 1.72]} /><meshStandardMaterial color="#25394a" metalness={0.5} roughness={0.2} /></mesh>
        {wheels}
      </group>
      <group ref={interceptor} visible={false}>
        <mesh position={[0, 0.62, 0]} castShadow={graphicsQuality === 'high'}><boxGeometry args={[1.78, 0.62, 3.82]} /><meshStandardMaterial color="#1d252d" metalness={0.62} roughness={0.3} /></mesh>
        <mesh position={[0, 1.05, -0.12]}><boxGeometry args={[1.38, 0.48, 1.78]} /><meshStandardMaterial color="#6b7e89" metalness={0.48} roughness={0.22} /></mesh>
        <mesh position={[-0.25, 1.36, -0.05]}><boxGeometry args={[0.36, 0.11, 0.18]} /><meshBasicMaterial color="#ff2e44" toneMapped={false} /></mesh>
        <mesh position={[0.25, 1.36, -0.05]}><boxGeometry args={[0.36, 0.11, 0.18]} /><meshBasicMaterial color="#2e8cff" toneMapped={false} /></mesh>
        {graphicsQuality === 'high' && <pointLight position={[0, 1.45, 0]} color="#648dff" intensity={28} distance={6} />}
        {wheels}
      </group>
    </>
  )
}

function Pedestrians({ graphicsQuality, worldTime, weather }: { graphicsQuality: GraphicsQuality; worldTime: number; weather: WeatherState }) {
  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const walker = useMemo(() => new Object3D(), [])
  const night = isNightTime(worldTime)
  const baseCount = graphicsQuality === 'high' ? 22 : graphicsQuality === 'medium' ? 13 : 6
  const count = Math.max(3, Math.floor(baseCount * (weather === 'rain' ? 0.42 : night ? 0.55 : 1)))
  const paths = useMemo(() => ROAD_SEGMENTS.filter((road) => road.kind !== 'highway').slice(0, count).map((road, index) => ({
    road,
    metrics: roadMetrics(road),
    offset: (index * 47) % Math.max(1, roadMetrics(road).length),
    speed: 0.7 + (index % 5) * 0.12,
    side: index % 2 === 0 ? 1 : -1,
  })), [count])

  useFrame(({ clock }) => {
    paths.forEach(({ road, metrics, offset, speed, side }, index) => {
      const travel = (clock.elapsedTime * speed + offset) % metrics.length
      const t = travel / metrics.length
      const edge = road.width / 2 + 1.5
      const perpendicularX = metrics.dz / metrics.length
      const perpendicularZ = -metrics.dx / metrics.length
      const x = road.start[0] + metrics.dx * t + perpendicularX * edge * side
      const z = road.start[1] + metrics.dz * t + perpendicularZ * edge * side
      const bob = Math.sin(clock.elapsedTime * 5.8 + index) * 0.035
      walker.position.set(x, 0.88 + bob, z)
      walker.rotation.set(0, metrics.heading, 0)
      walker.scale.set(1, 1, 1)
      walker.updateMatrix()
      bodies.current?.setMatrixAt(index, walker.matrix)
      walker.position.y = 1.72 + bob
      walker.scale.set(0.82, 0.82, 0.82)
      walker.updateMatrix()
      heads.current?.setMatrixAt(index, walker.matrix)
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, paths.length]}>
        <capsuleGeometry args={[0.18, 0.7, 4, 8]} />
        <meshStandardMaterial color="#42566c" roughness={0.84} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, paths.length]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshStandardMaterial color="#b88b73" roughness={0.9} />
      </instancedMesh>
    </>
  )
}

function ElevatedRail() {
  const pillars = useMemo(() => {
    const values: number[] = []
    for (let x = WORLD_BOUNDS.minX + 24; x <= WORLD_BOUNDS.maxX - 24; x += 48) values.push(x)
    return values
  }, [])

  return (
    <group>
      <mesh position={[(WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2, 8.2, -72]} castShadow>
        <boxGeometry args={[WORLD_WIDTH, 0.55, 5.4]} />
        <meshStandardMaterial color="#646b6e" metalness={0.54} roughness={0.5} />
      </mesh>
      {[-1.55, 1.55].map((zOffset) => (
        <mesh key={zOffset} position={[(WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2, 8.58, -72 + zOffset]}>
          <boxGeometry args={[WORLD_WIDTH, 0.12, 0.14]} />
          <meshStandardMaterial color="#373c3f" metalness={0.86} roughness={0.3} />
        </mesh>
      ))}
      {pillars.map((x) => (
        <group key={x} position={[x, 4.05, -72]}>
          <mesh>
            <boxGeometry args={[0.85, 8.1, 1.05]} />
            <meshStandardMaterial color="#777b79" roughness={0.72} />
          </mesh>
          <mesh position={[0, 3.72, 0]}>
            <boxGeometry args={[5.2, 0.7, 1.3]} />
            <meshStandardMaterial color="#777b79" roughness={0.72} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CommuterTrain() {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!root.current) return
    const length = WORLD_WIDTH + 90
    const x = WORLD_BOUNDS.minX - 45 + ((clock.elapsedTime * 18 + 80) % length)
    root.current.position.x = x
  })

  return (
    <group ref={root} position={[WORLD_BOUNDS.minX, 9.25, -72]}>
      {[-18, -6, 6, 18].map((x, index) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[11.2, 2.65, 3.4]} />
            <meshStandardMaterial color={index === 0 ? '#d9ddd9' : '#c9cfcd'} metalness={0.38} roughness={0.34} />
          </mesh>
          <mesh position={[0, -0.18, -1.72]}>
            <boxGeometry args={[8.8, 0.75, 0.08]} />
            <meshStandardMaterial color="#416e86" metalness={0.36} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.18, 1.72]}>
            <boxGeometry args={[8.8, 0.75, 0.08]} />
            <meshStandardMaterial color="#416e86" metalness={0.36} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <boxGeometry args={[9.2, 0.18, 2.8]} />
            <meshStandardMaterial color="#70787a" metalness={0.56} roughness={0.42} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function BusShelters() {
  const shelters: Array<{ position: [number, number, number]; rotation: number }> = [
    { position: [-118, 0, -84], rotation: Math.PI / 2 },
    { position: [118, 0, 80], rotation: -Math.PI / 2 },
    { position: [-18, 0, 104], rotation: Math.PI },
    { position: [208, 0, -132], rotation: 0 },
    { position: [-198, 0, 22], rotation: Math.PI },
    { position: [232, 0, 182], rotation: -Math.PI / 2 },
    { position: [-568, 0, 112], rotation: Math.PI / 2 },
    { position: [-742, 0, 328], rotation: Math.PI / 2 },
    { position: [408, 0, 328], rotation: -Math.PI / 2 },
    { position: [588, 0, 488], rotation: -Math.PI / 2 },
    { position: [748, 0, -286], rotation: -Math.PI / 2 },
    { position: [-408, 0, -312], rotation: Math.PI / 2 },
  ]
  return shelters.map((shelter, index) => (
    <group key={index} position={shelter.position} rotation-y={shelter.rotation}>
      <mesh position={[0, 1.7, 0.2]}>
        <boxGeometry args={[5.4, 3.3, 0.12]} />
        <meshStandardMaterial color="#718184" transparent opacity={0.42} metalness={0.2} roughness={0.18} />
      </mesh>
      <mesh position={[0, 3.38, -0.55]} rotation-x={-0.12}>
        <boxGeometry args={[5.8, 0.16, 1.7]} />
        <meshStandardMaterial color="#4e575b" metalness={0.56} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.68, -0.1]}>
        <boxGeometry args={[3.8, 0.18, 0.8]} />
        <meshStandardMaterial color="#6e513a" roughness={0.82} />
      </mesh>
    </group>
  ))
}

function Coastline({ graphicsQuality }: { graphicsQuality: GraphicsQuality }) {
  return (
    <group>
      <mesh position={[914, 0.015, 50]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[230, WORLD_DEPTH + 260]} />
        <meshPhysicalMaterial
          color="#4f8794"
          metalness={graphicsQuality === 'low' ? 0.08 : 0.18}
          roughness={graphicsQuality === 'high' ? 0.16 : 0.26}
          clearcoat={graphicsQuality === 'low' ? 0 : 0.35}
          clearcoatRoughness={0.22}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[836, 0.035, 60]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[72, WORLD_DEPTH + 110]} />
        <meshStandardMaterial color="#c5b28d" roughness={0.98} />
      </mesh>
      <mesh position={[798, 0.34, 55]}>
        <boxGeometry args={[1.1, 0.68, WORLD_DEPTH + 80]} />
        <meshStandardMaterial color="#9f9d94" roughness={0.72} />
      </mesh>
      {Array.from({ length: 20 }, (_, index) => (
        <mesh key={index} position={[820 + (index % 2) * 8, 0.38, WORLD_BOUNDS.minZ + 55 + index * 78]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.18, 0.28, 3.5 + (index % 3), 7]} />
          <meshStandardMaterial color="#8c806d" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function RegionalTerrain() {
  const hills = [
    [-990, 44, 600, 180, 88], [-920, 52, 770, 210, 105], [-740, 58, 850, 235, 116],
    [-510, 48, 865, 190, 96], [-270, 40, 860, 165, 80], [160, 35, 870, 150, 70],
  ] as const
  return (
    <group>
      {hills.map(([x, y, z, radius, height], index) => (
        <mesh key={index} position={[x, y - 4, z]} scale={[1, 1, 0.72]} receiveShadow>
          <coneGeometry args={[radius, height, 9]} />
          <meshStandardMaterial color={index % 2 ? '#6f7864' : '#64705d'} roughness={1} />
        </mesh>
      ))}
      <mesh position={[-930, 9, -500]} scale={[1, 0.4, 1.3]}>
        <dodecahedronGeometry args={[85, 0]} />
        <meshStandardMaterial color="#7a766a" roughness={1} />
      </mesh>
      <mesh position={[-860, 5, -620]} scale={[1.4, 0.24, 0.8]}>
        <dodecahedronGeometry args={[72, 0]} />
        <meshStandardMaterial color="#8a816d" roughness={1} />
      </mesh>
    </group>
  )
}

function RainField({ graphicsQuality }: { graphicsQuality: GraphicsQuality }) {
  const points = useRef<Points>(null)
  const count = graphicsQuality === 'high' ? 620 : graphicsQuality === 'medium' ? 340 : 140
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 92
      positions[index * 3 + 1] = Math.random() * 38
      positions[index * 3 + 2] = (Math.random() - 0.5) * 92
    }
    const next = new BufferGeometry()
    next.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return next
  }, [count])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ camera }, delta) => {
    if (!points.current) return
    points.current.position.set(camera.position.x, 1, camera.position.z)
    const positions = geometry.attributes.position.array as Float32Array
    for (let index = 0; index < count; index += 1) {
      const yIndex = index * 3 + 1
      positions[yIndex] -= delta * (20 + (index % 7))
      if (positions[yIndex] < 0) positions[yIndex] = 34 + (index % 5)
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#c7e6f4" size={graphicsQuality === 'low' ? 0.12 : 0.095} transparent opacity={0.72} depthWrite={false} />
    </points>
  )
}

function WorldEnvironment({ graphicsQuality, worldTime, weather }: { graphicsQuality: GraphicsQuality; worldTime: number; weather: WeatherState }) {
  const solarAngle = ((worldTime - 360) / 1440) * Math.PI * 2
  const sunHeight = Math.sin(solarAngle)
  const daylight = Math.max(0.03, Math.min(1, (sunHeight + 0.08) * 1.45))
  const nightColor = new Color('#071321')
  const dayColor = new Color(weather === 'rain' ? '#66737d' : weather === 'overcast' ? '#8b969d' : '#aab6c1')
  const background = nightColor.clone().lerp(dayColor, daylight).getStyle()
  const fogColor = new Color('#0a1723').lerp(new Color(weather === 'rain' ? '#6f7b83' : '#aeb7bd'), daylight).getStyle()
  const sunPosition: [number, number, number] = [Math.cos(solarAngle) * 110, sunHeight * 135, -85]
  const ambientIntensity = 0.16 + daylight * (weather === 'rain' ? 0.36 : 0.58)
  const hemisphereIntensity = 0.35 + daylight * (weather === 'rain' ? 0.62 : 1.3)

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fogColor, weather === 'rain' ? 170 : 260, GRAPHICS_PROFILES[graphicsQuality].drawDistance]} />
      <Sky distance={450000} sunPosition={sunPosition} turbidity={weather === 'clear' ? 9 : 13} rayleigh={weather === 'clear' ? 2.2 : 0.9} mieCoefficient={weather === 'rain' ? 0.02 : 0.006} mieDirectionalG={0.82} />
      <ambientLight color={daylight < 0.2 ? '#59728d' : '#dce3e7'} intensity={ambientIntensity} />
      <hemisphereLight args={[daylight < 0.2 ? '#627f9d' : '#dbe8ef', '#596052', hemisphereIntensity]} />
      <SunLight graphicsQuality={graphicsQuality} worldTime={worldTime} weather={weather} />
      {weather === 'rain' && <RainField graphicsQuality={graphicsQuality} />}
    </>
  )
}

function SunLight({ graphicsQuality, worldTime, weather }: { graphicsQuality: GraphicsQuality; worldTime: number; weather: WeatherState }) {
  const light = useRef<DirectionalLight>(null)
  const target = useRef<Object3D>(null)
  const profile = GRAPHICS_PROFILES[graphicsQuality]
  const solarAngle = ((worldTime - 360) / 1440) * Math.PI * 2
  const sunHeight = Math.sin(solarAngle)
  const daylight = Math.max(0.04, Math.min(1, (sunHeight + 0.08) * 1.45))

  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])

  useFrame(({ camera }) => {
    if (!light.current || !target.current) return
    light.current.position.set(camera.position.x + Math.cos(solarAngle) * 105, Math.max(30, 45 + sunHeight * 95), camera.position.z - 70)
    target.current.position.set(camera.position.x, 0, camera.position.z)
    target.current.updateMatrixWorld()
  })

  return (
    <>
      <directionalLight
        ref={light}
        color={daylight < 0.2 ? '#7da0c7' : weather === 'rain' ? '#cad3d8' : '#fff1d4'}
        intensity={(weather === 'rain' ? 1.85 : 3.5) * daylight}
        castShadow={profile.shadows}
        shadow-mapSize-width={profile.shadowSize}
        shadow-mapSize-height={profile.shadowSize}
        shadow-camera-left={-190}
        shadow-camera-right={190}
        shadow-camera-top={190}
        shadow-camera-bottom={-190}
        shadow-camera-far={340}
      />
      <object3D ref={target} />
    </>
  )
}

export function City({ graphicsQuality, worldTime, weather, trafficDensity, playerTelemetry, paused }: { graphicsQuality: GraphicsQuality; worldTime: number; weather: WeatherState; trafficDensity: TrafficDensity; playerTelemetry: CarTelemetry; paused: boolean }) {
  const profile = GRAPHICS_PROFILES[graphicsQuality]
  const night = isNightTime(worldTime)
  return (
    <>
      <WorldEnvironment graphicsQuality={graphicsQuality} worldTime={worldTime} weather={weather} />

      <GroundSurface />

      <RegionalTerrain />
      <Coastline graphicsQuality={graphicsQuality} />
      <RoadSurfaces graphicsQuality={graphicsQuality} weather={weather} />
      <RoadMarkings />
      <RoadWear count={profile.roadWear} />
      <HighwayInfrastructure />
      <FlyoversAndUnderpasses />
      <Crosswalks />
      <StreetLights spacing={profile.lightSpacing} active={night || weather === 'rain'} />
      <TrafficSignals />
      <BreakableRoadsideProps graphicsQuality={graphicsQuality} />
      <BusShelters />
      <SpecialLots />
      <DistrictPolish />
      <TreeInstances />
      <ElevatedRail />
      <CommuterTrain />
      <AmbientTraffic graphicsQuality={graphicsQuality} worldTime={worldTime} weather={weather} trafficDensity={trafficDensity} player={playerTelemetry} paused={paused} />
      <AmbientPursuit graphicsQuality={graphicsQuality} worldTime={worldTime} />
      <Pedestrians graphicsQuality={graphicsQuality} worldTime={worldTime} weather={weather} />
      {BUILDINGS.filter((building) => building.id.startsWith('core-')).map((building, index) => (
        <Building key={building.id} data={building} index={index} />
      ))}
      <RegionalBuildings night={night} />
      <Suspense fallback={null}>
        <RidgeEstates graphicsQuality={graphicsQuality} />
      </Suspense>
    </>
  )
}
