import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { Car, type CameraMode, type CarLoadState } from './Car'
import { City } from './City'
import { PoliceUnits } from './PoliceUnits'
import { RaceOpponents } from './RaceOpponents'
import { RaceWorld } from './RaceWorld'
import { PoliceTactics } from './PoliceTactics'
import type { CarDefinition } from './carCatalog'
import type { CarPerformance } from './carCatalog'
import type { CarCustomization } from './customization'
import type { WeatherState } from './dynamicWorld'
import type { CarTelemetry } from './carPhysics'
import type { PoliceTelemetry, PursuitState } from './policeSystem'
import type { PoliceTacticTelemetry } from './policeSystem'
import type { OpponentProgress, RaceSession } from './raceEvents'
import { GRAPHICS_PROFILES, type GraphicsQuality } from './graphicsSettings'
import type { ControlBindings, TrafficDensity } from './gameSettings'
import { RemoteVehicles } from '../multiplayer/RemoteVehicles'
import type { MultiplayerPlayer, MultiplayerSession, RaceProgress, SpawnPoint } from '../multiplayer/types'

interface GameCanvasProps {
  graphicsQuality: GraphicsQuality
  car: CarDefinition
  customization: CarCustomization
  performance: CarPerformance
  paused: boolean
  gamePaused: boolean
  race: RaceSession
  pursuit: PursuitState
  playerTelemetry: CarTelemetry
  manualTransmission: boolean
  mapOpen: boolean
  cameraMode: CameraMode
  lookBehind: boolean
  photoMode: boolean
  replayTrigger: number
  replayActive: boolean
  playerPosition: [number, number]
  worldTime: number
  weather: WeatherState
  resolutionScale: number
  trafficDensity: TrafficDensity
  bindings: ControlBindings
  controllerSensitivity: number
  controllerDeadzone: number
  onOpponentsReady: () => void
  onOpponentProgress: (progress: OpponentProgress[]) => void
  onPoliceTelemetry: (telemetry: PoliceTelemetry) => void
  policeTactics: PoliceTacticTelemetry
  onPoliceTactics: (telemetry: PoliceTacticTelemetry) => void
  onCarLoadState: (state: CarLoadState) => void
  onTelemetry: (telemetry: CarTelemetry) => void
  onReplayState: (active: boolean) => void
  onControllerStatus: (connected: boolean) => void
  onFpsUpdate: (fps: number) => void
  multiplayerSession?: MultiplayerSession | null
  multiplayerPlayers?: MultiplayerPlayer[]
  multiplayerPlayerId?: string | null
  multiplayerRaceProgress?: RaceProgress | null
  multiplayerSpawn?: SpawnPoint
  trafficEnabled?: boolean
  policeEnabled?: boolean
}

function FrameBudgetMonitor({ onFpsUpdate }: { onFpsUpdate: (fps: number) => void }) {
  const elapsed = useRef(0)
  const frames = useRef(0)
  const warmup = useRef(0)
  const handled = useRef(false)

  useFrame((state, delta) => {
    warmup.current += delta
    if (warmup.current < 5) return
    elapsed.current += Math.min(delta, 0.12)
    frames.current += 1
    if (elapsed.current < 5) return
    const fps = frames.current / elapsed.current
    onFpsUpdate(Math.round(fps))
    elapsed.current = 0
    frames.current = 0
    if (fps < 38 && !handled.current) {
      handled.current = true
      state.setDpr(Math.max(0.6, state.viewport.dpr * 0.74))
      state.gl.shadowMap.enabled = false
    }
  })
  return null
}

export function GameCanvas({
  graphicsQuality,
  car,
  customization,
  performance,
  paused,
  gamePaused,
  race,
  pursuit,
  playerTelemetry,
  manualTransmission,
  mapOpen,
  cameraMode,
  lookBehind,
  photoMode,
  replayTrigger,
  replayActive,
  playerPosition,
  worldTime,
  weather,
  resolutionScale,
  trafficDensity,
  bindings,
  controllerSensitivity,
  controllerDeadzone,
  onOpponentsReady,
  onOpponentProgress,
  onPoliceTelemetry,
  policeTactics,
  onPoliceTactics,
  onCarLoadState,
  onTelemetry,
  onReplayState,
  onControllerStatus,
  onFpsUpdate,
  multiplayerSession = null,
  multiplayerPlayers = [],
  multiplayerPlayerId = null,
  multiplayerRaceProgress = null,
  multiplayerSpawn,
  trafficEnabled = true,
  policeEnabled = true,
}: GameCanvasProps) {
  const profile = GRAPHICS_PROFILES[graphicsQuality]
  const scaledDpr: [number, number] = [profile.dpr[0] * resolutionScale, profile.dpr[1] * resolutionScale]
  const multiplayerRace = multiplayerSession?.mode === 'race'
  const raceWorldSession: RaceSession = multiplayerRace ? {
    phase: Date.now() < multiplayerSession.countdownEndsAt ? 'countdown' : multiplayerRaceProgress?.finished ? 'results' : 'racing',
    eventId: multiplayerSession.settings.raceRouteId,
    checkpointIndex: multiplayerRaceProgress?.checkpointIndex ?? 0,
    countdown: Math.max(0, Math.ceil((multiplayerSession.countdownEndsAt - Date.now()) / 1000)),
    elapsedMs: multiplayerRaceProgress?.elapsedMs ?? 0,
    livePosition: multiplayerRaceProgress?.finishPosition || 1,
    finishPosition: multiplayerRaceProgress?.finishPosition ?? 0,
    reward: 0,
    didNotFinish: false,
    repReward: 0,
    rivalDefeated: null,
  } : multiplayerSession ? { ...race, phase: 'results', eventId: null } : race
  return (
    <Canvas
      key={graphicsQuality}
      frameloop={gamePaused ? 'demand' : 'always'}
      shadows={profile.shadows}
      dpr={scaledDpr}
      camera={{ position: [-40, 3.5, -80], fov: 58, near: 0.1, far: profile.drawDistance }}
      gl={{ antialias: graphicsQuality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      performance={{ min: 0.55 }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.12
        gl.shadowMap.type = PCFSoftShadowMap
      }}
    >
      <Suspense fallback={null}>
        <FrameBudgetMonitor onFpsUpdate={onFpsUpdate} />
        <City graphicsQuality={graphicsQuality} worldTime={worldTime} weather={weather} trafficDensity={trafficDensity} trafficEnabled={trafficEnabled} playerTelemetry={playerTelemetry} paused={gamePaused || paused} />
        <RaceWorld session={raceWorldSession} />
        {!paused && policeEnabled && (
          <Suspense fallback={null}>
            <PoliceUnits pursuit={pursuit} player={playerTelemetry} onTelemetry={onPoliceTelemetry} />
          </Suspense>
        )}
        {!paused && policeEnabled && <PoliceTactics pursuit={pursuit} player={playerTelemetry} onTelemetry={onPoliceTactics} />}
        {!multiplayerSession && (race.phase === 'countdown' || race.phase === 'racing') && (
          <Suspense fallback={null}>
            <RaceOpponents
              session={race}
              playerPosition={playerPosition}
              onReady={onOpponentsReady}
              onProgress={onOpponentProgress}
            />
          </Suspense>
        )}
        {multiplayerSession && multiplayerPlayerId && (
          <RemoteVehicles
            players={multiplayerPlayers}
            localPlayerId={multiplayerPlayerId}
            graphicsQuality={graphicsQuality}
            collisions={multiplayerSession.settings.collisions}
            localPosition={playerPosition}
          />
        )}
        <Car
          graphicsQuality={graphicsQuality}
          car={car}
          customization={customization}
          performance={performance}
          paused={paused}
          gamePaused={gamePaused}
          controlsLocked={mapOpen || photoMode || replayActive || race.phase === 'countdown' || race.phase === 'results' || pursuit.phase === 'busted' || Boolean(multiplayerSession && Date.now() < multiplayerSession.countdownEndsAt) || Boolean(multiplayerRaceProgress?.finished)}
          manualTransmission={manualTransmission}
          onLoadState={onCarLoadState}
          spikeEventId={policeTactics.spikeEventId}
          cameraMode={cameraMode}
          lookBehind={lookBehind}
          photoMode={photoMode}
          replayTrigger={replayTrigger}
          onReplayState={onReplayState}
          onTelemetry={onTelemetry}
          bindings={bindings}
          controllerSensitivity={controllerSensitivity}
          controllerDeadzone={controllerDeadzone}
          onControllerStatus={onControllerStatus}
          spawnPoint={multiplayerSpawn}
          sessionId={multiplayerSession?.id}
        />
      </Suspense>
    </Canvas>
  )
}
