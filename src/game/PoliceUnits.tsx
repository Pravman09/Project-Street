import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  type Object3D,
} from 'three'
import { CAR_CATALOG } from './carCatalog'
import type { CarTelemetry } from './carPhysics'
import { removeDynamicVehicle, updateDynamicVehicle } from './dynamicVehicles'
import type { PoliceTelemetry, PursuitState } from './policeSystem'
import { ROAD_SEGMENTS, getFlyoverElevation, type RoadSegmentData } from './worldLayout'

interface PoliceUnitsProps {
  pursuit: PursuitState
  player: CarTelemetry
  onTelemetry: (telemetry: PoliceTelemetry) => void
}

interface TrailPoint {
  x: number
  z: number
}

interface PoliceAiState {
  x: number
  z: number
  heading: number
  speed: number
  patrolDistance: number
  patrolDirection: 1 | -1
  patrolRoad: RoadSegmentData
  patrolLane: number
  trailCursor: number
  activeInPursuit: boolean
}

const POLICE_CAR = CAR_CATALOG.find((car) => car.id === 'phantom-r') ?? CAR_CATALOG[0]
const UNIT_COUNT = 7
const PATROL_CONFIG = [
  { roadId: 'h-central', lane: -4, distance: 80, direction: 1 as const },
  { roadId: 'v-east-coast', lane: 4, distance: 470, direction: -1 as const },
  { roadId: 'v-west-suburb', lane: -4.2, distance: 760, direction: 1 as const },
  { roadId: 'h-outer-south', lane: 6.5, distance: 530, direction: -1 as const },
  { roadId: 'h-university', lane: -4, distance: 920, direction: 1 as const },
  { roadId: 'h-port', lane: 4.5, distance: 1160, direction: -1 as const },
  { roadId: 'ring-5', lane: -6.5, distance: 180, direction: 1 as const },
]

function roadMetrics(road: RoadSegmentData) {
  const dx = road.end[0] - road.start[0]
  const dz = road.end[1] - road.start[1]
  const length = Math.hypot(dx, dz)
  return { dx, dz, length, heading: Math.atan2(dx, dz) }
}

function sampleRoad(road: RoadSegmentData, distance: number, lane: number, direction: 1 | -1) {
  const metrics = roadMetrics(road)
  const clamped = MathUtils.clamp(distance, 0, metrics.length)
  const t = clamped / metrics.length
  const perpendicularX = metrics.dz / metrics.length
  const perpendicularZ = -metrics.dx / metrics.length
  return {
    x: road.start[0] + metrics.dx * t + perpendicularX * lane,
    z: road.start[1] + metrics.dz * t + perpendicularZ * lane,
    heading: metrics.heading + (direction < 0 ? Math.PI : 0),
  }
}

function clonePoliceCar(scene: Object3D) {
  const clone = scene.clone(true)
  const policeBlack = new Color('#151b22')
  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const tuned = materials.map((material) => {
      const copy = material.clone()
      if (copy instanceof MeshStandardMaterial) {
        copy.color.lerp(policeBlack, 0.62)
        copy.metalness = 0.42
        copy.roughness = 0.34
        copy.envMapIntensity = 1.55
      }
      return copy
    })
    object.material = Array.isArray(object.material) ? tuned : tuned[0]
  })
  return clone
}

function createInitialStates(): PoliceAiState[] {
  return PATROL_CONFIG.map((config) => {
    const road = ROAD_SEGMENTS.find((candidate) => candidate.id === config.roadId) ?? ROAD_SEGMENTS[0]
    const point = sampleRoad(road, config.distance, config.lane, config.direction)
    return {
      x: point.x,
      z: point.z,
      heading: point.heading,
      speed: 12,
      patrolDistance: config.distance,
      patrolDirection: config.direction,
      patrolRoad: road,
      patrolLane: config.lane,
      trailCursor: 0,
      activeInPursuit: false,
    }
  })
}

function angleDifference(target: number, current: number) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

export function PoliceUnits({ pursuit, player, onTelemetry }: PoliceUnitsProps) {
  const { scene } = useGLTF(POLICE_CAR.modelPath)
  const visuals = useMemo(() => Array.from({ length: UNIT_COUNT }, () => clonePoliceCar(scene)), [scene])
  const roots = useRef<Array<Group | null>>([])
  const redLights = useRef<Array<Group | null>>([])
  const blueLights = useRef<Array<Group | null>>([])
  const redGlows = useRef<Array<PointLight | null>>([])
  const blueGlows = useRef<Array<PointLight | null>>([])
  const states = useRef<PoliceAiState[]>(createInitialStates())
  const trail = useRef<TrailPoint[]>([{ x: player.position[0], z: player.position[1] }])
  const previousPhase = useRef(pursuit.phase)
  const reportTimer = useRef(0)

  useEffect(() => () => {
    for (let index = 0; index < UNIT_COUNT; index += 1) removeDynamicVehicle(`police-${index}`)
  }, [])

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.04)
    const playerX = player.position[0]
    const playerZ = player.position[1]
    const lastTrailPoint = trail.current[trail.current.length - 1]
    if (!lastTrailPoint || Math.hypot(playerX - lastTrailPoint.x, playerZ - lastTrailPoint.z) >= 4) {
      trail.current.push({ x: playerX, z: playerZ })
      if (trail.current.length > 220) {
        trail.current.shift()
        states.current.forEach((state) => { state.trailCursor = Math.max(0, state.trailCursor - 1) })
      }
    }

    const chaseActive = pursuit.phase === 'pursuit' || pursuit.phase === 'cooldown' || pursuit.phase === 'busted'
    const chaseStarted = chaseActive && previousPhase.current !== 'pursuit' && previousPhase.current !== 'cooldown'
    const chaseEnded = !chaseActive && (previousPhase.current === 'pursuit' || previousPhase.current === 'cooldown')

    if (chaseStarted) states.current.forEach((state) => { state.activeInPursuit = false })
    if (chaseEnded) states.current = createInitialStates()
    previousPhase.current = pursuit.phase

    const activeCount = chaseActive ? Math.min(UNIT_COUNT, Math.max(2, pursuit.heat + 2)) : 3
    const visiblePositions: Array<[number, number]> = []
    let nearestDistance = Number.POSITIVE_INFINITY

    states.current.forEach((state, index) => {
      const root = roots.current[index]
      const visible = index < activeCount && pursuit.phase !== 'escaped'

      if (!chaseActive) {
        if (index < 3) {
          const metrics = roadMetrics(state.patrolRoad)
          state.patrolDistance += 11.5 * state.patrolDirection * delta
          if (state.patrolDistance >= metrics.length) {
            state.patrolDistance = metrics.length
            state.patrolDirection = -1
          } else if (state.patrolDistance <= 0) {
            state.patrolDistance = 0
            state.patrolDirection = 1
          }
          const point = sampleRoad(state.patrolRoad, state.patrolDistance, state.patrolLane, state.patrolDirection)
          state.x = point.x
          state.z = point.z
          state.heading = point.heading
          state.speed = 11.5
        }
      } else if (index < activeCount) {
        if (!state.activeInPursuit) {
          const spawnOffset = 8 + index * 7
          const spawnIndex = Math.max(0, trail.current.length - 1 - spawnOffset)
          const spawn = trail.current[spawnIndex] ?? { x: playerX - Math.sin(player.heading) * (28 + index * 9), z: playerZ - Math.cos(player.heading) * (28 + index * 9) }
          const next = trail.current[Math.min(trail.current.length - 1, spawnIndex + 1)] ?? { x: playerX, z: playerZ }
          state.x = spawn.x
          state.z = spawn.z
          state.heading = Math.atan2(next.x - spawn.x, next.z - spawn.z)
          state.speed = 24 + index * 1.5
          state.trailCursor = Math.min(trail.current.length - 1, spawnIndex + 1)
          state.activeInPursuit = true
        }

        while (state.trailCursor < trail.current.length - 1) {
          const waypoint = trail.current[state.trailCursor]
          if (Math.hypot(waypoint.x - state.x, waypoint.z - state.z) > 8) break
          state.trailCursor += 1
        }

        const atTrailEnd = state.trailCursor >= trail.current.length - 2
        const interceptor = index > 0 && index % 2 === 1
        const lead = MathUtils.clamp(player.speedKmh / (interceptor ? 12 : 30), interceptor ? 10 : 3.5, interceptor ? 28 : 9)
        const flank = interceptor ? (index % 4 === 1 ? 7 : -7) : 0
        const target = atTrailEnd
          ? {
              x: playerX + Math.sin(player.heading) * lead + Math.cos(player.heading) * flank,
              z: playerZ + Math.cos(player.heading) * lead - Math.sin(player.heading) * flank,
            }
          : trail.current[Math.min(trail.current.length - 1, state.trailCursor + 3)]
        const dx = target.x - state.x
        const dz = target.z - state.z
        const targetHeading = Math.atan2(dx, dz)
        let turn = angleDifference(targetHeading, state.heading)

        const nearbyUnit = states.current.find((other, otherIndex) =>
          otherIndex !== index && otherIndex < activeCount && other.activeInPursuit && Math.hypot(other.x - state.x, other.z - state.z) < 6)
        if (nearbyUnit) turn += index % 2 === 0 ? 0.28 : -0.28

        const turnRate = 1.25 + pursuit.heat * 0.1
        state.heading += MathUtils.clamp(turn, -turnRate * delta, turnRate * delta)
        const cornerFactor = MathUtils.clamp(1 - Math.abs(turn) / Math.PI, 0.46, 1)
        const distanceToPlayer = Math.hypot(playerX - state.x, playerZ - state.z)
        const catchup = distanceToPlayer > 75 ? 5 : 0
        const targetSpeed = (36 + pursuit.heat * 3.2 + catchup + (index >= 5 ? 3.5 : 0)) * cornerFactor
        const acceleration = targetSpeed > state.speed ? 9.5 : 18
        state.speed = MathUtils.damp(state.speed, targetSpeed, acceleration / Math.max(targetSpeed, 1), delta)
        state.x += Math.sin(state.heading) * state.speed * delta
        state.z += Math.cos(state.heading) * state.speed * delta

        if (distanceToPlayer > 230 && trail.current.length > 18) {
          const respawnIndex = Math.max(0, trail.current.length - 16 - index * 3)
          const respawn = trail.current[respawnIndex]
          state.x = respawn.x
          state.z = respawn.z
          state.trailCursor = Math.min(trail.current.length - 1, respawnIndex + 1)
          state.speed = 28
        }
      }

      const distance = Math.hypot(playerX - state.x, playerZ - state.z)
      if (visible) {
        nearestDistance = Math.min(nearestDistance, distance)
        visiblePositions.push([state.x, state.z])
      }

      if (root) {
        root.visible = visible
        root.position.set(state.x, getFlyoverElevation(state.x, state.z, state.heading), state.z)
        root.rotation.y = state.heading
      }

      if (visible) {
        updateDynamicVehicle({
          id: `police-${index}`,
          kind: 'police',
          x: state.x,
          y: getFlyoverElevation(state.x, state.z, state.heading),
          z: state.z,
          heading: state.heading,
          speed: state.speed,
          radius: 1.55,
        })
      } else {
        removeDynamicVehicle(`police-${index}`)
      }

      const flashOn = chaseActive && visible
      const alternating = Math.floor(clock.elapsedTime * 8 + index) % 2 === 0
      if (redLights.current[index]) redLights.current[index]!.visible = flashOn && alternating
      if (blueLights.current[index]) blueLights.current[index]!.visible = flashOn && !alternating
      if (redGlows.current[index]) redGlows.current[index]!.intensity = flashOn && alternating ? 34 : 0
      if (blueGlows.current[index]) blueGlows.current[index]!.intensity = flashOn && !alternating ? 34 : 0
    })

    reportTimer.current += delta
    if (reportTimer.current >= 0.14) {
      reportTimer.current = 0
      onTelemetry({ nearestDistance, activeUnits: activeCount, unitPositions: visiblePositions })
    }
  })

  return (
    <>
      {visuals.map((visual, index) => (
        <group key={index} ref={(root) => { roots.current[index] = root }}>
          <primitive object={visual} scale={index >= 5 ? [5.1, 5.5, 5.1] : 4.5} position={[0, index >= 5 ? POLICE_CAR.modelYOffset + 0.18 : POLICE_CAR.modelYOffset, 0]} />

          <mesh position={[-1.03, 0.78, 0]}>
            <boxGeometry args={[0.055, 0.5, 1.45]} />
            <meshStandardMaterial color="#e8edf0" roughness={0.5} />
          </mesh>
          <mesh position={[1.03, 0.78, 0]}>
            <boxGeometry args={[0.055, 0.5, 1.45]} />
            <meshStandardMaterial color="#e8edf0" roughness={0.5} />
          </mesh>

          <group position={[0, 1.45, -0.16]}>
            <mesh>
              <boxGeometry args={[1.18, 0.11, 0.24]} />
              <meshStandardMaterial color="#10151b" metalness={0.7} roughness={0.28} />
            </mesh>
            <group ref={(light) => { redLights.current[index] = light }} position={[-0.31, 0.08, 0]}>
              <mesh>
                <boxGeometry args={[0.5, 0.16, 0.2]} />
                <meshBasicMaterial color="#ff183d" toneMapped={false} />
              </mesh>
            </group>
            <group ref={(light) => { blueLights.current[index] = light }} position={[0.31, 0.08, 0]}>
              <mesh>
                <boxGeometry args={[0.5, 0.16, 0.2]} />
                <meshBasicMaterial color="#1677ff" toneMapped={false} />
              </mesh>
            </group>
          </group>

          <pointLight ref={(light) => { redGlows.current[index] = light }} position={[-0.45, 1.72, -0.1]} color="#ff1744" intensity={0} distance={14} />
          <pointLight ref={(light) => { blueGlows.current[index] = light }} position={[0.45, 1.72, -0.1]} color="#1677ff" intensity={0} distance={14} />
          <pointLight position={[-0.7, 0.67, 2.05]} color="#e4f4ff" intensity={28} distance={14} />
          <pointLight position={[0.7, 0.67, 2.05]} color="#e4f4ff" intensity={28} distance={14} />
          {index >= 5 && <mesh position={[0, 1.15, -2.2]}><boxGeometry args={[1.4, 0.34, 0.12]} /><meshBasicMaterial color="#ffcc42" toneMapped={false} /></mesh>}
        </group>
      ))}
    </>
  )
}
