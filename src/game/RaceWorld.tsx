import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Group } from 'three'
import { RACE_EVENTS, getRaceEvent, type RaceEventDefinition, type RacePoint, type RaceSession } from './raceEvents'

function EventMarker({ event }: { event: RaceEventDefinition }) {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!root.current) return
    root.current.rotation.y = clock.elapsedTime * 0.55
    root.current.position.y = Math.sin(clock.elapsedTime * 1.8 + event.start.x) * 0.18
  })

  return (
    <group position={[event.start.x, 0, event.start.z]}>
      <group ref={root}>
        <mesh position={[0, 0.2, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[5.4, 0.25, 10, 42]} />
          <meshBasicMaterial color={event.color} transparent opacity={0.88} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3.5, 0]} rotation-z={Math.PI / 4}>
          <octahedronGeometry args={[0.85]} />
          <meshBasicMaterial color={event.color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <cylinderGeometry args={[0.32, 2.2, 4.2, 18, 1, true]} />
          <meshBasicMaterial color={event.color} transparent opacity={0.13} side={DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function checkpointHeading(point: RacePoint, previous: RacePoint) {
  return Math.atan2(point.x - previous.x, point.z - previous.z)
}

function CheckpointGate({ point, previous, color, preview = false }: {
  point: RacePoint
  previous: RacePoint
  color: string
  preview?: boolean
}) {
  const root = useRef<Group>(null)
  const heading = checkpointHeading(point, previous)
  useFrame(({ clock }) => {
    if (!root.current) return
    const pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.04
    root.current.scale.setScalar(pulse)
  })

  return (
    <group ref={root} position={[point.x, 0, point.z]} rotation-y={heading}>
      {[-5.5, 5.5].map((x) => (
        <group key={x} position={[x, 3.2, 0]}>
          <mesh>
            <boxGeometry args={[0.34, 6.4, 0.34]} />
            <meshBasicMaterial color={color} transparent opacity={preview ? 0.24 : 0.92} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.9, 0.24, 0.9]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={preview ? 0.18 : 0.72} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 6.25, 0]}>
        <boxGeometry args={[11.3, 0.3, 0.3]} />
        <meshBasicMaterial color={color} transparent opacity={preview ? 0.24 : 0.84} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.13, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[4.5, 5.3, 32]} />
        <meshBasicMaterial color={color} transparent opacity={preview ? 0.1 : 0.36} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function RaceWorld({ session }: { session: RaceSession }) {
  const event = getRaceEvent(session.eventId)
  const current = event?.checkpoints[session.checkpointIndex]
  const next = event?.checkpoints[session.checkpointIndex + 1]
  const previous = event
    ? session.checkpointIndex === 0
      ? event.start
      : event.checkpoints[session.checkpointIndex - 1]
    : null

  return (
    <>
      {session.phase === 'free-roam' && RACE_EVENTS.map((raceEvent) => <EventMarker key={raceEvent.id} event={raceEvent} />)}
      {(session.phase === 'countdown' || session.phase === 'racing') && event && current && previous && (
        <CheckpointGate point={current} previous={previous} color={event.color} />
      )}
      {session.phase === 'racing' && event && next && current && (
        <CheckpointGate point={next} previous={current} color={event.color} preview />
      )}
    </>
  )
}
