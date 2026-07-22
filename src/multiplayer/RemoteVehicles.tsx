import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group, MathUtils, Vector3 } from 'three'
import { CarVisualModel } from '../game/Car'
import { CAR_CATALOG, DEFAULT_CAR } from '../game/carCatalog'
import { DEFAULT_CUSTOMIZATION } from '../game/customization'
import { removeDynamicVehicle, updateDynamicVehicle } from '../game/dynamicVehicles'
import type { GraphicsQuality } from '../game/graphicsSettings'
import { subscribeToRemoteVehicle } from './vehicleStore'
import type { MultiplayerPlayer, VehicleNetworkState } from './types'

function angleDamp(current: number, target: number, smoothing: number, delta: number) {
  const difference = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI
  return current + difference * (1 - Math.exp(-smoothing * delta))
}

function RemoteVehicle({ player, graphicsQuality, collisions, localPosition }: {
  player: MultiplayerPlayer
  graphicsQuality: GraphicsQuality
  collisions: boolean
  localPosition: [number, number]
}) {
  const root = useRef<Group>(null)
  const target = useRef<VehicleNetworkState | null>(null)
  const display = useRef(new Vector3())
  const initialized = useRef(false)
  const heading = useRef(0)
  const car = CAR_CATALOG.find((candidate) => candidate.id === player.vehicleId) ?? DEFAULT_CAR
  const customization = useMemo(() => ({ ...DEFAULT_CUSTOMIZATION, paint: player.bodyColor }), [player.bodyColor])
  const dynamicId = `multiplayer-${player.id}`

  useEffect(() => subscribeToRemoteVehicle(player.id, (state) => { target.current = state }), [player.id])
  useEffect(() => () => removeDynamicVehicle(dynamicId), [dynamicId])

  useFrame((_state, rawDelta) => {
    const state = target.current
    const group = root.current
    if (!state || !group) return
    const delta = Math.min(0.05, rawDelta)
    const age = Math.min(0.16, Math.max(0, (Date.now() - state.timestamp) / 1000))
    const predictedX = state.x + state.velocityX * age
    const predictedZ = state.z + state.velocityZ * age
    const distanceToTarget = Math.hypot(predictedX - display.current.x, state.y - display.current.y, predictedZ - display.current.z)
    if (!initialized.current || distanceToTarget > 30) {
      display.current.set(predictedX, state.y, predictedZ)
      heading.current = state.heading
      initialized.current = true
    } else {
      const smoothing = state.speedKmh < 2 ? 7 : 12
      display.current.x = MathUtils.damp(display.current.x, predictedX, smoothing, delta)
      display.current.y = MathUtils.damp(display.current.y, state.y, 11, delta)
      display.current.z = MathUtils.damp(display.current.z, predictedZ, smoothing, delta)
      heading.current = angleDamp(heading.current, state.heading, 13, delta)
    }
    group.position.copy(display.current)
    group.rotation.y = heading.current
    const distanceToLocal = Math.hypot(display.current.x - localPosition[0], display.current.z - localPosition[1])
    const visibleDistance = graphicsQuality === 'low' ? 260 : graphicsQuality === 'medium' ? 420 : 620
    group.visible = player.connected && distanceToLocal < visibleDistance
    if (collisions && player.connected && distanceToLocal < 160) {
      updateDynamicVehicle({
        id: dynamicId,
        kind: 'player',
        x: display.current.x,
        y: display.current.y,
        z: display.current.z,
        heading: heading.current,
        speed: state.speedKmh / 3.6,
        radius: 1.2,
      })
    } else {
      removeDynamicVehicle(dynamicId)
    }
  })

  return (
    <group ref={root} visible={false}>
      <CarVisualModel car={car} customization={customization} graphicsQuality={graphicsQuality === 'high' ? 'medium' : graphicsQuality} />
      <mesh position={[-0.62, 0.68, -2.13]}><boxGeometry args={[0.38, 0.16, 0.07]} /><meshBasicMaterial color="#ff3049" toneMapped={false} /></mesh>
      <mesh position={[0.62, 0.68, -2.13]}><boxGeometry args={[0.38, 0.16, 0.07]} /><meshBasicMaterial color="#ff3049" toneMapped={false} /></mesh>
      <Html position={[0, 2.65, 0]} center distanceFactor={11} occlude={false} className="remote-player-label">
        <span style={{ '--player-color': player.bodyColor } as React.CSSProperties}>{player.name}</span>
      </Html>
    </group>
  )
}

export function RemoteVehicles({ players, localPlayerId, graphicsQuality, collisions, localPosition }: {
  players: MultiplayerPlayer[]
  localPlayerId: string
  graphicsQuality: GraphicsQuality
  collisions: boolean
  localPosition: [number, number]
}) {
  return <>{players.filter((player) => player.id !== localPlayerId).map((player) => (
    <RemoteVehicle key={player.id} player={player} graphicsQuality={graphicsQuality} collisions={collisions} localPosition={localPosition} />
  ))}</>
}

