import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Group, MathUtils, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { CAR_CATALOG } from './carCatalog'
import {
  RACE_OPPONENTS,
  getRaceEvent,
  getRaceRoute,
  type OpponentProgress,
  type RaceSession,
} from './raceEvents'
import { getFlyoverElevation } from './worldLayout'

interface RaceOpponentsProps {
  session: RaceSession
  playerPosition: [number, number]
  onReady: () => void
  onProgress: (progress: OpponentProgress[]) => void
}

interface AiState {
  distance: number
  lane: number
  finished: boolean
  finishMs: number
}

const OPPONENT_CARS = RACE_OPPONENTS.map((opponent) => CAR_CATALOG.find((car) => car.id === opponent.carId)!)
const BASE_LANES = [-2.8, 2.8, 0]

function cloneCar(scene: Object3D) {
  const clone = scene.clone(true)
  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const tuned = materials.map((material) => {
      const copy = material.clone()
      if (copy instanceof MeshStandardMaterial) {
        copy.metalness = 0.34
        copy.roughness = 0.38
        copy.envMapIntensity = 1.55
      }
      return copy
    })
    object.material = Array.isArray(object.material) ? tuned : tuned[0]
  })
  return clone
}

export function RaceOpponents({ session, playerPosition, onReady, onProgress }: RaceOpponentsProps) {
  const nova = useGLTF(OPPONENT_CARS[0].modelPath).scene
  const ryder = useGLTF(OPPONENT_CARS[1].modelPath).scene
  const kael = useGLTF(OPPONENT_CARS[2].modelPath).scene
  const visuals = useMemo(() => [cloneCar(nova), cloneCar(ryder), cloneCar(kael)], [kael, nova, ryder])
  const roots = useRef<Array<Group | null>>([])
  const states = useRef<AiState[]>([])
  const reportTimer = useRef(0)
  const event = getRaceEvent(session.eventId)
  const route = useMemo(() => event ? getRaceRoute(event) : null, [event])

  useEffect(() => onReady(), [onReady])

  useEffect(() => {
    states.current = RACE_OPPONENTS.map((_, index) => ({
      distance: -(index + 1) * 4.8,
      lane: BASE_LANES[index],
      finished: false,
      finishMs: 0,
    }))
    reportTimer.current = 0
  }, [session.eventId])

  useFrame((_, rawDelta) => {
    if (!event || !route) return
    const delta = Math.min(rawDelta, 0.04)

    const sampleRoute = (distance: number, lane: number) => {
      if (distance <= 0) {
        const start = route.points[0]
        const next = route.points[1]
        const dx = next.x - start.x
        const dz = next.z - start.z
        const length = Math.hypot(dx, dz)
        const forwardX = dx / length
        const forwardZ = dz / length
        const perpendicularX = forwardZ
        const perpendicularZ = -forwardX
        return {
          x: start.x + forwardX * distance + perpendicularX * lane,
          z: start.z + forwardZ * distance + perpendicularZ * lane,
          heading: Math.atan2(dx, dz),
        }
      }

      const clamped = Math.min(distance, route.totalLength)
      let segmentIndex = route.segmentLengths.length - 1
      for (let index = 0; index < route.segmentLengths.length; index += 1) {
        if (clamped <= route.cumulative[index + 1]) {
          segmentIndex = index
          break
        }
      }
      const start = route.points[segmentIndex]
      const end = route.points[segmentIndex + 1]
      const segmentDistance = clamped - route.cumulative[segmentIndex]
      const t = route.segmentLengths[segmentIndex] > 0 ? segmentDistance / route.segmentLengths[segmentIndex] : 0
      const dx = end.x - start.x
      const dz = end.z - start.z
      const length = route.segmentLengths[segmentIndex]
      const perpendicularX = dz / length
      const perpendicularZ = -dx / length
      return {
        x: start.x + dx * t + perpendicularX * lane,
        z: start.z + dz * t + perpendicularZ * lane,
        heading: Math.atan2(dx, dz),
      }
    }

    states.current.forEach((state, index) => {
      if (session.phase === 'racing' && !state.finished) {
        const targetSpeed = route.totalLength / event.rivalTimes[index]
        const rhythm = 1 + Math.sin(session.elapsedMs * 0.0013 + index * 2.1) * 0.035
        const carAhead = states.current.find((other, otherIndex) => otherIndex !== index && other.distance > state.distance && other.distance - state.distance < 11)
        const overtakeBoost = carAhead ? 1.04 : 1
        state.distance += targetSpeed * rhythm * overtakeBoost * delta
        if (state.distance >= route.totalLength) {
          state.distance = route.totalLength
          state.finished = true
          state.finishMs = event.rivalTimes[index] * 1000
        }
      }

      const baseSample = sampleRoute(state.distance, BASE_LANES[index])
      const playerDistance = Math.hypot(baseSample.x - playerPosition[0], baseSample.z - playerPosition[1])
      const nearbyOpponent = states.current.find((other, otherIndex) =>
        otherIndex !== index && Math.abs(other.distance - state.distance) < 9 && Math.abs(other.lane - state.lane) < 2.5)
      let targetLane = BASE_LANES[index]
      if (nearbyOpponent) targetLane += index % 2 === 0 ? 2.6 : -2.6
      if (playerDistance < 11) targetLane += index % 2 === 0 ? 3.2 : -3.2
      state.lane = MathUtils.damp(state.lane, targetLane, 3.8, delta)

      const sample = sampleRoute(state.distance, state.lane)
      const root = roots.current[index]
      if (root) {
        root.visible = session.phase === 'countdown' || session.phase === 'racing'
        root.position.set(sample.x, getFlyoverElevation(sample.x, sample.z, sample.heading), sample.z)
        root.rotation.y = MathUtils.damp(root.rotation.y, sample.heading, 8, delta)
      }
    })

    reportTimer.current += delta
    if (reportTimer.current >= 0.1) {
      reportTimer.current = 0
      onProgress(states.current.map((state, index) => ({
        id: RACE_OPPONENTS[index].id,
        progress: Math.max(0, Math.min(1, state.distance / route.totalLength)),
        finished: state.finished,
        finishMs: state.finishMs,
      })))
    }
  })

  return (
    <>
      {RACE_OPPONENTS.map((opponent, index) => (
        <group key={opponent.id} ref={(root) => { roots.current[index] = root }}>
          <primitive
            object={visuals[index]}
            scale={4.5}
            position={[0, OPPONENT_CARS[index].modelYOffset, 0]}
          />
          <mesh position={[0, 0.12, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[1.25, 28]} />
            <meshBasicMaterial color={opponent.accent} transparent opacity={0.17} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}
