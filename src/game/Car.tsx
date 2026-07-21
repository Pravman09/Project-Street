import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Vector3,
} from 'three'
import { ArcadeCarPhysics, type CarTelemetry } from './carPhysics'
import type { CarDefinition, CarPerformance } from './carCatalog'
import { useKeyboard } from './useKeyboard'
import type { GraphicsQuality } from './graphicsSettings'
import { getRideHeightOffset, type CarCustomization } from './customization'
import type { ControlBindings } from './gameSettings'

interface CarProps {
  graphicsQuality: GraphicsQuality
  car: CarDefinition
  customization: CarCustomization
  performance: CarPerformance
  paused: boolean
  gamePaused: boolean
  controlsLocked: boolean
  manualTransmission: boolean
  onLoadState: (state: CarLoadState) => void
  spikeEventId: number
  cameraMode: CameraMode
  lookBehind: boolean
  photoMode: boolean
  replayTrigger: number
  onReplayState: (active: boolean) => void
  onTelemetry: (telemetry: CarTelemetry) => void
  bindings: ControlBindings
  controllerSensitivity: number
  controllerDeadzone: number
  onControllerStatus: (connected: boolean) => void
}

export type CarLoadState = 'idle' | 'loading' | 'ready' | 'error'
export type CameraMode = 'chase' | 'hood' | 'cinematic'

interface ReplayFrame { x: number; y: number; z: number; heading: number }

const carModelCache = new Map<string, Promise<Group>>()

function loadCarModel(path: string) {
  const cached = carModelCache.get(path)
  if (cached) return cached
  const request = new Promise<Group>((resolve, reject) => {
    new GLTFLoader().load(path, (gltf) => resolve(gltf.scene), undefined, reject)
  }).catch((error) => {
    carModelCache.delete(path)
    throw error
  })
  carModelCache.set(path, request)
  return request
}

const CAMERA_UP = new Vector3(0, 1, 0)

function LoadedCarModel({ car, customization, graphicsQuality, onLoadState }: { car: CarDefinition; customization: CarCustomization; graphicsQuality: GraphicsQuality; onLoadState: (state: CarLoadState) => void }) {
  const [rendered, setRendered] = useState<{ scene: Group; car: CarDefinition } | null>(null)

  useEffect(() => {
    let active = true
    onLoadState('loading')
    const tryLoad = async () => {
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const source = await loadCarModel(car.modelPath)
          if (!active) return
          const clone = source.clone(true)
      clone.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.castShadow = graphicsQuality !== 'low'
        object.receiveShadow = graphicsQuality !== 'low'
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        const tuned = materials.map((material) => {
          const copy = material.clone()
          if (copy instanceof MeshStandardMaterial) {
            if (customization.paint !== 'factory') copy.color.copy(new Color(customization.paint))
            const finishMetalness = customization.finish === 'metallic' ? 0.82 : customization.finish === 'satin' ? 0.34 : 0.58
            const finishRoughness = customization.finish === 'satin' ? 0.5 : customization.finish === 'metallic' ? 0.18 : 0.24
            copy.metalness = graphicsQuality === 'low' ? Math.min(finishMetalness, 0.42) : finishMetalness
            copy.roughness = graphicsQuality === 'low' ? Math.max(finishRoughness, 0.36) : finishRoughness
            copy.envMapIntensity = graphicsQuality === 'high' ? 2.4 : graphicsQuality === 'medium' ? 1.9 : 1.4
          }
          return copy
        })
        object.material = Array.isArray(object.material) ? tuned : tuned[0]
      })
          setRendered({ scene: clone, car })
          onLoadState('ready')
          return
        } catch (error) {
          lastError = error
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 650 * (attempt + 1)))
        }
      }
      console.error(`Car model failed after retries: ${car.modelPath}`, lastError)
      if (active) onLoadState('error')
    }
    void tryLoad()

    return () => {
      active = false
    }
  }, [car, customization.finish, customization.paint, graphicsQuality, onLoadState])

  useEffect(() => () => {
    rendered?.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    })
  }, [rendered])

  if (!rendered) return null
  return (
    <primitive
      object={rendered.scene}
      scale={4.5}
      position={[0, rendered.car.modelYOffset, 0]}
      rotation-y={rendered.car.modelRotationY ?? 0}
    />
  )
}

export function Car({ graphicsQuality, car: selectedCar, customization, performance: carPerformance, paused, gamePaused, controlsLocked, manualTransmission, onLoadState, spikeEventId, cameraMode, lookBehind, photoMode, replayTrigger, onReplayState, onTelemetry, bindings, controllerSensitivity, controllerDeadzone, onControllerStatus }: CarProps) {
  const root = useRef<Group>(null)
  const visual = useRef<Group>(null)
  const leftFlame = useRef<Mesh>(null)
  const rightFlame = useRef<Mesh>(null)
  const leftFlameMaterial = useRef<MeshBasicMaterial>(null)
  const rightFlameMaterial = useRef<MeshBasicMaterial>(null)
  const sparks = useRef<Group>(null)
  const damageSmoke = useRef<Group>(null)
  const smokeMaterials = useRef<Array<MeshBasicMaterial | null>>([])
  const brakeLight = useRef<PointLight>(null)
  const physics = useRef(new ArcadeCarPhysics())
  const input = useKeyboard({ bindings, controllerSensitivity, controllerDeadzone, onControllerStatus })
  const { camera } = useThree()
  const cameraTarget = useRef(new Vector3(-40, 1.2, -67))
  const telemetryTimer = useRef(0)
  const handledSpikeEvent = useRef(0)
  const replayHistory = useRef<ReplayFrame[]>([])
  const replayFrames = useRef<ReplayFrame[]>([])
  const replayIndex = useRef(0)
  const replayAccumulator = useRef(0)
  const replayRecordingTimer = useRef(0)
  const replaying = useRef(false)
  const replayDisplayPosition = useRef(new Vector3())
  const replayNextPosition = useRef(new Vector3())
  const previousImpact = useRef(0)
  const previousShiftKick = useRef(0)

  const pulseController = (strongMagnitude: number, weakMagnitude: number, duration: number) => {
    const pad = navigator.getGamepads?.().find((candidate) => candidate?.connected)
    const actuator = pad?.vibrationActuator as GamepadHapticActuator | undefined
    if (!actuator || typeof actuator.playEffect !== 'function') return
    void actuator.playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude })
  }

  useEffect(() => {
    physics.current.setPerformance(carPerformance)
    physics.current.reset()
    replayHistory.current = []
    replayFrames.current = []
    replaying.current = false
    onReplayState(false)
  }, [carPerformance, onReplayState, selectedCar])

  useEffect(() => {
    physics.current.setTransmissionMode(manualTransmission)
  }, [manualTransmission])

  useEffect(() => {
    if (paused) physics.current.reset()
  }, [paused])

  useEffect(() => {
    if (controlsLocked) physics.current.stop()
  }, [controlsLocked])

  useEffect(() => {
    if (spikeEventId <= handledSpikeEvent.current) return
    handledSpikeEvent.current = spikeEventId
    physics.current.hitSpikeStrip()
  }, [spikeEventId])

  useEffect(() => {
    if (replayTrigger <= 0 || replayHistory.current.length < 20) return
    replayFrames.current = replayHistory.current.map((frame) => ({ ...frame }))
    replayIndex.current = 0
    replayAccumulator.current = 0
    replaying.current = true
    physics.current.stop()
    onReplayState(true)
  }, [onReplayState, replayTrigger])

  const sparkPattern = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = index * 2.399
    const radius = 0.55 + (index % 4) * 0.2
    return [Math.cos(angle) * radius, 0.2 + (index % 3) * 0.17, Math.sin(angle) * radius] as [number, number, number]
  }), [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.04)
    const car = physics.current

    if (!paused && !gamePaused && !controlsLocked && !replaying.current) car.update(delta, input.current)

    let displayPosition = car.position
    let displayHeading = car.heading
    if (replaying.current) {
      replayAccumulator.current += delta
      if (replayAccumulator.current >= 0.065) {
        replayAccumulator.current = 0
        replayIndex.current += 1
      }
      const frame = replayFrames.current[replayIndex.current]
      if (!frame) {
        replaying.current = false
        onReplayState(false)
      } else {
        const nextFrame = replayFrames.current[replayIndex.current + 1] ?? frame
        const blend = replayAccumulator.current / 0.065
        replayNextPosition.current.set(nextFrame.x, nextFrame.y, nextFrame.z)
        replayDisplayPosition.current.set(frame.x, frame.y, frame.z).lerp(replayNextPosition.current, blend)
        displayPosition = replayDisplayPosition.current
        displayHeading = MathUtils.lerp(frame.heading, nextFrame.heading, blend)
      }
    } else if (!paused && !gamePaused && !photoMode) {
      replayRecordingTimer.current += delta
      if (replayRecordingTimer.current >= 0.065) {
        replayRecordingTimer.current = 0
        replayHistory.current.push({ x: car.position.x, y: car.position.y, z: car.position.z, heading: car.heading })
        if (replayHistory.current.length > 230) replayHistory.current.shift()
      }
    }

    if (root.current) {
      root.current.position.copy(displayPosition)
      root.current.rotation.y = displayHeading
    }

    if (visual.current) {
      const leanTarget = -car.steering * Math.min(car.velocity.length() / 45, 1) * 0.055
      const pitchTarget = car.throttle * -0.018
      visual.current.rotation.z = MathUtils.damp(visual.current.rotation.z, leanTarget, 7, delta)
      visual.current.rotation.x = MathUtils.damp(visual.current.rotation.x, pitchTarget, 5, delta)
    }

    if (leftFlame.current && rightFlame.current) {
      const exhaustBurst = car.nitroActive || car.shiftKick > 0.18
      leftFlame.current.visible = exhaustBurst
      rightFlame.current.visible = exhaustBurst
      const pulse = 0.8 + Math.sin(window.performance.now() * 0.035) * 0.18
      const burstScale = car.nitroActive ? pulse : 0.5 + car.shiftKick * 0.35
      leftFlame.current.scale.setScalar(burstScale)
      rightFlame.current.scale.setScalar(burstScale)
      const flameColor = car.nitroActive ? '#31e8ff' : '#ff9c38'
      leftFlameMaterial.current?.color.set(flameColor)
      rightFlameMaterial.current?.color.set(flameColor)
    }

    if (sparks.current) {
      sparks.current.visible = car.impact > 0.08
      sparks.current.scale.setScalar(0.65 + (1 - car.impact) * 2.8)
      sparks.current.rotation.y += delta * 5.5
    }

    if (damageSmoke.current) {
      damageSmoke.current.visible = car.damage > 42
      damageSmoke.current.position.y = 0.95 + Math.sin(state.clock.elapsedTime * 2.4) * 0.08
      damageSmoke.current.rotation.y += delta * 0.28
      const smokeOpacity = MathUtils.clamp((car.damage - 42) / 100, 0.05, 0.38)
      smokeMaterials.current.forEach((material, index) => {
        if (material) material.opacity = smokeOpacity * (0.75 + index * 0.1)
      })
    }

    if (brakeLight.current) brakeLight.current.intensity = car.braking ? 72 : 10

    if (car.impact > 0.3 && previousImpact.current <= 0.3) pulseController(Math.min(1, car.impact), 0.46, 115)
    if (car.shiftKick > 0.72 && previousShiftKick.current <= 0.72) pulseController(0.12, 0.3, 55)
    previousImpact.current = car.impact
    previousShiftKick.current = car.shiftKick

    const forward = new Vector3(Math.sin(displayHeading), 0, Math.cos(displayHeading))
    const speedOffset = Math.min(car.velocity.length() / 55, 1) * 1.2
    const previewAngle = state.clock.elapsedTime * 0.24
    let desiredCamera: Vector3
    let desiredTarget: Vector3
    if (photoMode) {
      const photoAngle = state.clock.elapsedTime * 0.18
      desiredCamera = new Vector3(Math.sin(photoAngle) * 9.5, 3.1, Math.cos(photoAngle) * 9.5).add(displayPosition)
      desiredTarget = displayPosition.clone().add(new Vector3(0, 0.9, 0))
    } else if (paused) {
      desiredCamera = new Vector3(Math.sin(previewAngle) * 7.6, 2.65, Math.cos(previewAngle) * 7.6).add(displayPosition)
      desiredTarget = displayPosition.clone().add(new Vector3(0, 0.9, 0))
    } else if (lookBehind) {
      desiredCamera = new Vector3(0, 2.7, 5.4).applyAxisAngle(CAMERA_UP, displayHeading).add(displayPosition)
      desiredTarget = displayPosition.clone().add(new Vector3(0, 1, 0)).addScaledVector(forward, -5)
    } else if (cameraMode === 'hood') {
      desiredCamera = new Vector3(0, 1.35, 1.45).applyAxisAngle(CAMERA_UP, displayHeading).add(displayPosition)
      desiredTarget = displayPosition.clone().add(new Vector3(0, 1.15, 0)).addScaledVector(forward, 18)
    } else if (cameraMode === 'cinematic' || replaying.current) {
      desiredCamera = new Vector3(-5.8, 2.5, -4.8 - speedOffset).applyAxisAngle(CAMERA_UP, displayHeading).add(displayPosition)
      desiredTarget = displayPosition.clone().add(new Vector3(0, 0.9, 0)).addScaledVector(forward, 3)
    } else {
      desiredCamera = new Vector3(0, 3.25, -7.1 - speedOffset).applyAxisAngle(CAMERA_UP, displayHeading).add(displayPosition)
      desiredTarget = displayPosition.clone().add(new Vector3(0, 1.05, 0)).addScaledVector(forward, 3.6)
    }

    if (!paused && !gamePaused) {
      const impactShake = car.impact * 0.34
      desiredCamera.x += Math.sin(state.clock.elapsedTime * 83) * impactShake
      desiredCamera.y += Math.cos(state.clock.elapsedTime * 67) * impactShake * 0.55 + car.shiftKick * 0.1
      desiredCamera.z += Math.sin(state.clock.elapsedTime * 71) * impactShake * 0.7
      desiredTarget.y += Math.sin(state.clock.elapsedTime * 59) * impactShake * 0.22
    }

    camera.position.lerp(desiredCamera, 1 - Math.exp(-4.8 * delta))
    cameraTarget.current.lerp(desiredTarget, 1 - Math.exp(-6.2 * delta))
    camera.lookAt(cameraTarget.current)

    if (camera instanceof PerspectiveCamera) {
      const targetFov = photoMode ? 45 : cameraMode === 'hood' ? 66 : paused ? 48 : 58 + Math.min(car.velocity.length() / 55, 1) * 9
      camera.fov = MathUtils.damp(camera.fov, targetFov, 4, delta)
      camera.updateProjectionMatrix()
    }

    telemetryTimer.current += delta
    if (telemetryTimer.current >= 0.08) {
      telemetryTimer.current = 0
      onTelemetry(car.getTelemetry())
    }
  })

  return (
    <group ref={root}>
      <group ref={visual} position-y={getRideHeightOffset(customization.rideHeight)}>
        <LoadedCarModel car={selectedCar} customization={customization} graphicsQuality={graphicsQuality} onLoadState={onLoadState} />

        {customization.underglow !== 'off' && (
          <>
            <mesh position={[0, 0.17, -0.05]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[1.42, 24]} />
              <meshBasicMaterial color={customization.underglow} transparent opacity={0.34} depthWrite={false} />
            </mesh>
            {graphicsQuality !== 'low' && <pointLight position={[0, 0.34, 0]} color={customization.underglow} intensity={32} distance={5.4} />}
          </>
        )}

        {customization.tint !== 'light' && (
          <mesh position={[0, 1.06, -0.12]} scale={customization.tint === 'black' ? 1.02 : 1}>
            <boxGeometry args={[1.34, 0.42, 1.56]} />
            <meshStandardMaterial color="#101820" metalness={0.46} roughness={0.16} transparent opacity={customization.tint === 'black' ? 0.8 : 0.48} />
          </mesh>
        )}

        {customization.wheelStyle !== 'stock' && [-1, 1].flatMap((side) => [-1.22, 1.22].map((z) => (
          <group key={`${side}-${z}`} position={[side * 1.04, 0.5, z]} rotation-z={Math.PI / 2}>
            <mesh>
              <cylinderGeometry args={[0.31, 0.31, 0.08, customization.wheelStyle === 'mesh' ? 20 : 10]} />
              <meshStandardMaterial color={customization.rimColor} metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position-y={side * 0.05}>
              <cylinderGeometry args={[0.09, 0.09, 0.1, 12]} />
              <meshStandardMaterial color="#16191d" metalness={0.65} roughness={0.4} />
            </mesh>
          </group>
        )))}
        <pointLight position={[0, 5.2, -0.8]} color="#dce8ff" intensity={graphicsQuality === 'high' ? 105 : 62} distance={18} />

        <pointLight position={[-0.72, 0.72, 2.05]} color="#b9f5ff" intensity={graphicsQuality === 'low' ? 20 : 42} distance={19} />
        <pointLight position={[0.72, 0.72, 2.05]} color="#b9f5ff" intensity={graphicsQuality === 'low' ? 20 : 42} distance={19} />
        <pointLight ref={brakeLight} position={[0, 0.68, -2.04]} color="#ff243d" intensity={10} distance={6.5} />
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, 0.68, -2.13]}>
            <boxGeometry args={[0.38, 0.16, 0.07]} />
            <meshBasicMaterial color="#ff3049" toneMapped={false} />
          </mesh>
        ))}

        <mesh ref={leftFlame} visible={false} position={[-0.48, 0.48, -2.25]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.1, 0.75, 10]} />
          <meshBasicMaterial ref={leftFlameMaterial} color="#31e8ff" transparent opacity={0.9} toneMapped={false} />
        </mesh>
        <mesh ref={rightFlame} visible={false} position={[0.48, 0.48, -2.25]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.1, 0.75, 10]} />
          <meshBasicMaterial ref={rightFlameMaterial} color="#31e8ff" transparent opacity={0.9} toneMapped={false} />
        </mesh>

        <group ref={sparks} visible={false} position={[0, 0.38, 0]}>
          {sparkPattern.map((position, index) => (
            <mesh key={index} position={position} rotation-z={index * 0.63}>
              <boxGeometry args={[0.035, 0.035, 0.5 + (index % 3) * 0.18]} />
              <meshBasicMaterial color={index % 3 === 0 ? '#fff1a1' : '#ff8b24'} toneMapped={false} />
            </mesh>
          ))}
        </group>

        <group ref={damageSmoke} visible={false} position={[0, 1, 1.05]}>
          {[[-0.28, 0, 0], [0.2, 0.2, -0.08], [0, 0.48, 0.06]].map((position, index) => (
            <mesh key={index} position={position as [number, number, number]} scale={0.72 + index * 0.18}>
              <sphereGeometry args={[0.45, 9, 7]} />
              <meshBasicMaterial
                ref={(material) => { smokeMaterials.current[index] = material }}
                color="#45505a"
                transparent
                opacity={0.12}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
