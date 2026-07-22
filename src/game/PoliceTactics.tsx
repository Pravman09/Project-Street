import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { CarTelemetry } from './carPhysics'
import { removeDynamicVehicle, updateDynamicVehicle } from './dynamicVehicles'
import type { PoliceTacticTelemetry, PursuitState } from './policeSystem'

interface PoliceTacticsProps {
  pursuit: PursuitState
  player: CarTelemetry
  onTelemetry: (telemetry: PoliceTacticTelemetry) => void
}

const ROADBLOCKS = [
  { id: 'central', x: 130, z: 10, rotation: Math.PI / 2 },
  { id: 'harbor', x: 600, z: -420, rotation: Math.PI / 2 },
  { id: 'west', x: -580, z: 170, rotation: 0 },
] as const

const SPIKES = [
  { id: 'market', x: -210, z: 92, rotation: Math.PI / 2 },
  { id: 'bay', x: 420, z: -145, rotation: 0 },
] as const

const BREAKERS = [
  { id: 'construction', x: -312, z: 265 },
  { id: 'southworks', x: -640, z: -455 },
] as const

const HIDING_SPOTS = [
  { id: 'garage-alley', x: -85, z: -31 },
  { id: 'marina-sheds', x: 790, z: 150 },
  { id: 'ridge-tunnel', x: -760, z: 410 },
] as const

export function PoliceTactics({ pursuit, player, onTelemetry }: PoliceTacticsProps) {
  const [broken, setBroken] = useState<string[]>([])
  const triggeredSpikes = useRef(new Set<string>())
  const spikeEventId = useRef(0)
  const breakerEventId = useRef(0)
  const reportTimer = useRef(0)

  const chase = pursuit.phase === 'pursuit' || pursuit.phase === 'cooldown'
  const activeRoadblocks = chase && pursuit.heat >= 2 ? ROADBLOCKS.slice(0, Math.min(ROADBLOCKS.length, pursuit.heat - 1)) : []
  const activeSpikes = chase && pursuit.heat >= 3 ? SPIKES.slice(0, Math.min(SPIKES.length, pursuit.heat - 2)) : []

  useEffect(() => {
    ROADBLOCKS.forEach((roadblock) => [-1, 1].forEach((side) => removeDynamicVehicle(`roadblock-${roadblock.id}-${side}`)))
  }, [])

  useEffect(() => {
    if (pursuit.phase !== 'patrol') return
    triggeredSpikes.current.clear()
    setBroken([])
  }, [pursuit.phase])

  useFrame((_, delta) => {
    const [playerX, playerZ] = player.position
    activeRoadblocks.forEach((roadblock) => {
      const sin = Math.sin(roadblock.rotation)
      const cos = Math.cos(roadblock.rotation)
      ;[-1, 1].forEach((side) => updateDynamicVehicle({
        id: `roadblock-${roadblock.id}-${side}`,
        kind: 'police',
        x: roadblock.x + cos * side * 4.3,
        y: 0.08,
        z: roadblock.z - sin * side * 4.3,
        heading: roadblock.rotation,
        speed: 0,
        radius: 2.25,
      }))
    })
    ROADBLOCKS.filter((roadblock) => !activeRoadblocks.includes(roadblock)).forEach((roadblock) => {
      ;[-1, 1].forEach((side) => removeDynamicVehicle(`roadblock-${roadblock.id}-${side}`))
    })

    activeSpikes.forEach((spike) => {
      if (triggeredSpikes.current.has(spike.id)) return
      if (Math.hypot(playerX - spike.x, playerZ - spike.z) < 5) {
        triggeredSpikes.current.add(spike.id)
        spikeEventId.current += 1
      }
    })

    if (pursuit.phase === 'pursuit') {
      BREAKERS.forEach((breaker) => {
        if (broken.includes(breaker.id)) return
        if (Math.hypot(playerX - breaker.x, playerZ - breaker.z) < 9 && player.speedKmh > 45) {
          setBroken((current) => [...current, breaker.id])
          breakerEventId.current += 1
        }
      })
    }

    const inHidingSpot = pursuit.phase === 'cooldown' && player.speedKmh < 18 && HIDING_SPOTS.some((spot) => Math.hypot(playerX - spot.x, playerZ - spot.z) < 18)
    reportTimer.current += delta
    if (reportTimer.current > 0.12) {
      reportTimer.current = 0
      onTelemetry({ spikeEventId: spikeEventId.current, breakerEventId: breakerEventId.current, inHidingSpot, roadblockActive: activeRoadblocks.length > 0 })
    }
  })

  return (
    <>
      {activeRoadblocks.map((roadblock) => (
        <group key={roadblock.id} position={[roadblock.x, 0, roadblock.z]} rotation-y={roadblock.rotation}>
          {[-4.3, 4.3].map((x) => <group key={x} position={[x, 0, 0]}><mesh position={[0, 0.62, 0]}><boxGeometry args={[3.6, 1.05, 1.8]} /><meshStandardMaterial color="#151c24" metalness={0.45} roughness={0.42} /></mesh><pointLight position={[0, 1.2, 0]} color={x < 0 ? '#ff173f' : '#1677ff'} intensity={55} distance={13} /></group>)}
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[4.2, 0.7, 0.38]} /><meshStandardMaterial color="#f0c84b" roughness={0.7} /></mesh>
        </group>
      ))}
      {activeSpikes.map((spike) => <group key={spike.id} position={[spike.x, 0.1, spike.z]} rotation-y={spike.rotation}><mesh><boxGeometry args={[11, 0.08, 0.52]} /><meshStandardMaterial color="#171b20" metalness={0.7} roughness={0.4} /></mesh>{Array.from({ length: 13 }, (_, index) => <mesh key={index} position={[-5.4 + index * 0.9, 0.18, 0]}><coneGeometry args={[0.09, 0.28, 5]} /><meshStandardMaterial color="#d7dbda" metalness={0.9} roughness={0.25} /></mesh>)}</group>)}
      {BREAKERS.filter((breaker) => !broken.includes(breaker.id)).map((breaker) => <group key={breaker.id} position={[breaker.x, 0, breaker.z]}><mesh position={[0, 4.2, 0]}><boxGeometry args={[13, 8.4, 1.1]} /><meshStandardMaterial color="#b47738" roughness={0.8} /></mesh><mesh position={[0, 9, 0]}><boxGeometry args={[16, 1.2, 1.2]} /><meshStandardMaterial color="#e0b34e" roughness={0.7} /></mesh></group>)}
      {HIDING_SPOTS.map((spot) => <group key={spot.id} position={[spot.x, 0.12, spot.z]}><mesh rotation-x={-Math.PI / 2}><ringGeometry args={[15, 17, 40]} /><meshBasicMaterial color={pursuit.phase === 'cooldown' ? '#4cff9d' : '#365449'} transparent opacity={0.48} /></mesh></group>)}
      {pursuit.heat >= 5 && chase && <group position={[player.position[0] - 18, 31, player.position[1] - 25]}><mesh><boxGeometry args={[7, 2.2, 11]} /><meshStandardMaterial color="#1a222a" metalness={0.55} roughness={0.38} /></mesh><mesh position={[0, 1.3, 0]}><boxGeometry args={[24, 0.18, 0.6]} /><meshStandardMaterial color="#313b42" metalness={0.7} roughness={0.35} /></mesh><pointLight position={[0, -3, 3]} color="#fff3cf" intensity={160} distance={55} /></group>}
    </>
  )
}
